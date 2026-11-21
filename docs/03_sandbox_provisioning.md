# ChaosEngine AI — Dynamic Kubernetes Sandbox Provisioning (M3 Architecture Specification)

## 1. Overview & Architectural Principles

Milestone M3 advances ChaosEngine AI from a frontend prototype to an operational, tenant-isolated Kubernetes sandbox provisioning engine. Every sandbox provides an isolated testing playground containing microservices configured with injected proxy sidecars for chaos experimentation, strictly confined within tenant boundaries.

### Core Architectural Invariants

1. **Strict Server-Controlled Namespace Isolation**:
   The tenant or user never supplies or selects the target namespace directly. Namespaces are dynamically synthesized following the format:
   ```text
   sandbox-{tenant_slug}-{short_uuid}
   ```
   System namespaces (`kube-system`, `default`, `chaos-control-plane`) and any production namespaces (`prod*`, `production*`, `live*`, `main`, `stage*`) are strictly blocked at both the safety validation layer and admission boundary.

2. **Defense-in-Depth Kubernetes Confinement**:
   Every provisioned sandbox namespace is automatically bound with:
   - **Pod Security Standards**: Enforced at `baseline:latest` with audit and warning flags.
   - **Unprivileged RBAC**: Dedicated `ServiceAccount` with `automountServiceAccountToken: false`, preventing any pod from accessing the cluster control-plane API (`kubernetes.default.svc`).
   - **Default-Deny NetworkPolicy**: Isolates the namespace from external networks, other tenant sandboxes, and host infrastructure. Egress is whitelisted only for intra-sandbox services, CoreDNS (UDP/TCP 53), OpenTelemetry Collector (TCP 4317), and Toxiproxy management (TCP 8474).
   - **Resource Quotas & Limit Ranges**: Hard quotas limiting CPU, memory, and pod count, alongside default container limit ranges to prevent "noisy neighbor" resource starvation.

3. **Chaos-Ready Microservice Topology**:
   Every application workload deployment is injected with a `toxiproxy` sidecar (`ghcr.io/shopify/toxiproxy:2.9.0`). Ingress traffic to the microservice enters through the proxy port (`8080`), routing to the application container (`8081`). This architecture enables zero-downtime, sub-millisecond fault injection (latency, bandwidth degradation, packet corruption, TCP reset) without requiring root host privileges.

---

## 2. Sandbox Lifecycle State Machine

```
              ┌───────────────┐
              │    PENDING    │  Record created, idempotency validated
              └───────┬───────┘
                      │ (async provisioning started)
                      ▼
              ┌───────────────┐
      ┌───────┤ PROVISIONING  ├───────┐
      │       └───────┬───────┘       │
      │ (failure)     │ (all steps    │ (timeout / watchdog)
      │               │  succeeded)   │
      ▼               ▼               ▼
┌───────────┐   ┌───────────┐   ┌───────────┐
│  FAILED   │   │   READY   │   │  FAILED   │
└─────┬─────┘   └─────┬─────┘   └───────────┘
      │               │
      │ (auto rollback│ (manual teardown or TTL expiration)
      │  cleanup)     ▼
      │         ┌───────────┐
      └────────►│TERMINATING│
                └─────┬─────┘
                      │ (k8s namespace deletion completed)
                      ▼
                ┌───────────┐
                │TERMINATED │
                └───────────┘
```

### Lifecycle States

| State | Description | Transition Trigger |
| :--- | :--- | :--- |
| `PENDING` | Sandbox record initialized in database, namespace hash generated. | Creation request accepted with 202 status. |
| `PROVISIONING` | Async engine orchestrating manifests (Namespace -> RBAC -> Quotas -> NetPol -> Workloads). | Background task pick-up. |
| `READY` | All deployments and services active, health verified, network isolation verified. | Successful probe of all workloads. |
| `FAILED` | Provisioning step failed or exceeded `K8S_PROVISIONING_TIMEOUT_SECONDS` (180s). | Exception raised during apply or timeout. |
| `TERMINATING` | Teardown initiated; Kubernetes namespace deletion call dispatched. | Operator deletion request or watchdog TTL trigger. |
| `TERMINATED` | Kubernetes resources purged; sandbox marked terminated in database. | Namespace deletion verified. |

---

## 3. REST API Specification

### Endpoint Summary

All sandbox endpoints are mounted at `/api/v1/sandboxes` and require Bearer token authentication scoped to the active tenant (`X-Tenant-ID`).

| Method | Endpoint | Allowed Roles | Description | Status Code |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/sandboxes` | `TenantOwner`, `Engineer` | Provision a new Kubernetes sandbox | `202 Accepted` |
| `GET` | `/api/v1/sandboxes` | `TenantOwner`, `Engineer`, `Viewer` | List sandboxes scoped to tenant/project | `200 OK` |
| `GET` | `/api/v1/sandboxes/{id}` | `TenantOwner`, `Engineer`, `Viewer` | Retrieve sandbox details & workloads | `200 OK` |
| `GET` | `/api/v1/sandboxes/{id}/status` | `TenantOwner`, `Engineer`, `Viewer` | High-frequency polling endpoint | `200 OK` |
| `DELETE` | `/api/v1/sandboxes/{id}` | `TenantOwner`, `Engineer` | Terminate sandbox and delete namespace | `202 Accepted` |
| `POST` | `/api/v1/sandboxes/reconcile` | `TenantOwner`, `Engineer` | Trigger manual watchdog reconciliation | `200 OK` |

### Idempotency Contract

The `POST /api/v1/sandboxes` endpoint honors the `Idempotency-Key` HTTP header:
- Repeated requests containing the identical `Idempotency-Key` within a tenant return the existing `SandboxRecord` without creating duplicate namespaces or deploying duplicate workloads.
- Cache duration: 24 hours.

---

## 4. Kubernetes Resource Synthesis Engine

When a sandbox transitions to `PROVISIONING`, `K8sManifestBuilder` generates typed Kubernetes manifests:

### 1. Isolated Namespace
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: sandbox-{tenant_slug}-{short_uuid}
  labels:
    chaosengine.io/managed-by: platform
    chaosengine.io/sandbox-id: {uuid}
    chaosengine.io/tenant-id: {tenant_uuid}
    chaosengine.io/project-id: {project_uuid}
    pod-security.kubernetes.io/enforce: baseline
    pod-security.kubernetes.io/audit: baseline
    pod-security.kubernetes.io/warn: baseline
```

### 2. ServiceAccount & Namespace-Scoped RBAC
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: sandbox-sa
  namespace: sandbox-{tenant_slug}-{short_uuid}
automountServiceAccountToken: false
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: sandbox-workload-role
  namespace: sandbox-{tenant_slug}-{short_uuid}
rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: sandbox-workload-binding
  namespace: sandbox-{tenant_slug}-{short_uuid}
subjects:
  - kind: ServiceAccount
    name: sandbox-sa
    namespace: sandbox-{tenant_slug}-{short_uuid}
roleRef:
  kind: Role
  name: sandbox-workload-role
  apiGroup: rbac.authorization.k8s.io
```

### 3. Default-Deny NetworkPolicy
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-isolate
  namespace: sandbox-{tenant_slug}-{short_uuid}
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    # Whitelist intra-sandbox pod-to-pod communication
    - from:
        - podSelector: {}
    # Whitelist control-plane chaos agent access to Toxiproxy management port
    - ports:
        - protocol: TCP
          port: 8474
  egress:
    # Whitelist intra-sandbox pod-to-pod communication
    - to:
        - podSelector: {}
    # Whitelist CoreDNS resolution
    - to:
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - protocol: UDP
          port: 53
        - protocol: TCP
          port: 53
    # Whitelist OpenTelemetry collector telemetry export
    - ports:
        - protocol: TCP
          port: 4317
```

### 4. Workload Deployment with Toxiproxy Sidecar
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
  namespace: sandbox-{tenant_slug}-{short_uuid}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: order-service
  template:
    metadata:
      labels:
        app: order-service
    spec:
      serviceAccountName: sandbox-sa
      automountServiceAccountToken: false
      containers:
        # Microservice application container
        - name: app
          image: chaosengine/order-service:1.0.0
          ports:
            - containerPort: 8081
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
        # Injected Toxiproxy chaos sidecar
        - name: toxiproxy-sidecar
          image: ghcr.io/shopify/toxiproxy:2.9.0
          ports:
            - containerPort: 8080 # Ingress Proxy Port
            - containerPort: 8474 # Management Port
          args: ["-host=0.0.0.0"]
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 200m
              memory: 128Mi
```

---

## 5. Reconciliation Engine & Watchdog Loop

The `SandboxReconciler` acts as a background supervisor to maintain consistency between PostgreSQL database state and the live Kubernetes cluster:

1. **Stuck Provisioning Recovery**:
   Scans sandboxes in `PROVISIONING` state where `(now - updated_at) > K8S_PROVISIONING_TIMEOUT_SECONDS` (default: 180s). Automatically marks them `FAILED`, records an audit event, and purges any partially created namespace.

2. **Automated TTL Teardown**:
   Evaluates `expires_at` timestamps for active sandboxes. When expired, triggers safe teardown (`TERMINATING` -> `TERMINATED`) and issues namespace deletion.

3. **Orphan Namespace Garbage Collection**:
   Queries live Kubernetes namespaces prefixed with `sandbox-`. Compares them against active database records. If a namespace exists on the cluster without an active database record, the watchdog issues a graceful delete to reclaim cluster compute and IP resources.
