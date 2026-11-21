# ChaosEngine AI — Interactive Service Topology Editor (M4 Architecture Specification)

## 1. Overview & Architectural Principles

Milestone M4 establishes the interactive service topology modeling and deployment engine for ChaosEngine AI. Built on `@xyflow/react` (React Flow v13) and unified with the established Obsidian Telemetry visual identity, the topology editor transforms visual microservice graph definitions directly into validated, chaos-ready Kubernetes workloads without requiring developers to author manual YAML manifests.

### Core Architectural Invariants

1. **Zero-YAML Direct Deployment & Server Validation**:
   Frontend users model microservice topologies graphically (adding nodes, defining network edges, configuring resource profiles, and setting environment variables). Before deployment, the backend server validates the full directed graph against RFC 1123 naming rules, container catalog whitelists, port ranges, and structural invariants. Topologies are synthesized server-side into Kubernetes `Deployment` and `ClusterIP Service` manifests with injected Toxiproxy sidecars.

2. **Semantic Cycle Analysis (Non-Fatal Asynchronous Cycles)**:
   In distributed architectures, cyclic dependencies can represent either dangerous synchronous deadlocks or legitimate asynchronous event-driven choreographies (e.g., an order service publishing Kafka events consumed by notification service, which queries order service for details). Rather than unconditionally rejecting all cycles, the validation engine detects elementary cycles using Depth-First Search (DFS) and inspects edge protocols:
   - **Synchronous cycles** (`HTTP`, `gRPC`) produce critical architectural warnings regarding potential cascading deadlocks and timeout storms.
   - **Asynchronous cycles** (`AMQP`, `event-driven`) are classified as benign event loops with advisory warnings on idempotency, message deduplication, and dead-letter queues, allowing the graph to remain valid for deployment.

3. **Optimistic Concurrency Control & Snapshot Versioning**:
   Every service topology record maintains an integer `version` field. When mutating or deploying a topology, clients pass `expected_version`. If a concurrent update has incremented the version, the backend rejects the write with an `HTTP 409 Conflict`, preventing overwrite race conditions. Full immutable snapshot copies are preserved in `topology_versions` upon every save, enabling one-click historical rollbacks.

4. **Strict Container Image Catalog Enforcement**:
   To prevent remote code execution (RCE) and supply-chain vulnerabilities, container images must match the approved platform image catalog:
   - Application Services: `chaosengine/api-gateway:*`, `chaosengine/order-service:*`, `chaosengine/payment-service:*`, `chaosengine/inventory-service:*`, `chaosengine/notification-service:*`, `chaosengine/external-mock:*`
   - Data Stores: `postgres:16-alpine`, `redis:7.2-alpine`
   - Proxy Sidecars: `ghcr.io/shopify/toxiproxy:2.9.0`
   Arbitrary container registries (`docker.io/untrusted/*`, latest tags without sha, raw URLs) are rejected at both API and Kubernetes manifest building layers.

5. **Defense-in-Depth Secret Sanitization**:
   The topology editor prohibits raw secret storage within node environment definitions. String heuristic scanners flag keys containing `PASSWORD`, `SECRET`, `TOKEN`, `KEY`, or `CREDENTIAL` unless values reference Kubernetes `SecretKeyRef` syntax (`secretKeyRef:...`).

---

## 2. Interactive Canvas Architecture (`@xyflow/react`)

The topology editor UI is mounted at route `/topology` and is built using `@xyflow/react` v13.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ TOPOLOGY TOOLBAR                                                           │
│ [Service Mesh Topology] [SANDBOX ISOLATED] [v2] [UNSAVED]                  │
│ Palette: [+ Service] [+ Gateway] [+ Postgres] [+ Redis] [+ External]      │
│ Actions: [Search...] [✓ Graph Valid] [⏱ History] [💾 Save] [🚀 Deploy]     │
├─────────────────────────────────────────────────┬──────────────────────────┤
│ REACT FLOW CANVAS                               │ PROPERTY INSPECTOR       │
│                                                 │                          │
│   ┌──────────────┐         ┌──────────────┐     │ Node: payment-service    │
│   │ API Gateway  ├────────►│ Order Service│     │ Type: app_service        │
│   └──────────────┘ (HTTP)  └──────┬───────┘     │ Image: order-svc:1.0.0   │
│                                   │             │ Port: 8081               │
│                                   ▼             │ Replicas: 2              │
│                            ┌──────────────┐     │ CPU Limit: 500m          │
│                            │ Postgres DB  │     │ Mem Limit: 512Mi         │
│                            └──────────────┘     │ Health: /health (8081)   │
│                                                 │ Env Vars:                │
│                                                 │   DB_HOST: orders-db     │
│ [MiniMap] [Controls] [Zero-YAML Direct Deploy]  │ [Update Properties]      │
└─────────────────────────────────────────────────┴──────────────────────────┘
```

### Visual Identity (Obsidian Telemetry)

- **Canvas Background**: Deep space `#09090b` with zinc grid dots (`#27272a`).
- **Surface Elevation**: `#111113` header toolbar, `#18181b` node containers and inspector panels.
- **Borders & Dividers**: Crisp 1px `#27272a` borders with rounded geometry (`rounded-lg`, `rounded-md`).
- **Accent Highlighting**: Indigo `#6366f1` for active selection, connections, and primary actions.
- **Node Type Badges**:
  - `api_gateway`: Cyan badge (`#06b6d4`, `#0891b2`) with router icon.
  - `app_service`: Indigo badge (`#6366f1`, `#4f46e5`) with server icon.
  - `postgres`: Blue badge (`#3b82f6`, `#2563eb`) with database cylinder icon.
  - `redis`: Amber badge (`#f59e0b`, `#d97706`) with lightning icon.
  - `external`: Emerald badge (`#10b981`, `#059669`) with cloud external icon.
- **Connection Edges**: Directed bezier curves with custom protocol badges (`HTTP`, `gRPC`, `AMQP`, `TCP`). Synchronous edges are solid; asynchronous dependencies are styled with subtle dashed lines.

---

## 3. Node Types and Specification Schema

### 1. `api_gateway`
- **Role**: Ingress proxy and perimeter router for the microservice cluster.
- **Default Image**: `chaosengine/api-gateway:1.0.0`
- **Default Port**: `8081` (Toxiproxy proxy listen: `8080`)
- **Routing**: Ingress point connecting to internal downstream application services.

### 2. `app_service`
- **Role**: Domain business logic service (e.g., `order-service`, `payment-service`, `inventory-service`).
- **Configurable Attributes**: Replicas, CPU/Memory request & limit, container port, environment variables, health checks (`path`, `port`, `initialDelaySeconds`, `periodSeconds`).

### 3. `postgres`
- **Role**: Relational database persistence.
- **Default Image**: `postgres:16-alpine`
- **Default Port**: `5432`
- **Invariants**: Disallows outgoing HTTP dependencies; acts as terminal storage dependency.

### 4. `redis`
- **Role**: In-memory cache and session state broker.
- **Default Image**: `redis:7.2-alpine`
- **Default Port**: `6379`
- **Invariants**: Terminal or broker node.

### 5. `external`
- **Role**: Third-party external APIs outside the Kubernetes cluster boundary (e.g., Stripe PSP, SendGrid, Twilio).
- **Default Image**: `chaosengine/external-mock:1.0.0`
- **Default Port**: `443`
- **Proxy Injection**: Bound with an egress proxy allowing chaos latency and timeout injection into third-party calls.

---

## 4. Graph Validation Engine

Validation is executed both client-side for rapid feedback and server-side in `TopologyValidator.validate(nodes, edges)`.

```
Directed Graph Input (Nodes, Edges)
                │
                ├─► 1. Node ID RFC 1123 Check (`^[a-z0-9]([-a-z0-9]*[a-z0-9])?$`)
                ├─► 2. Duplicate Node ID & Name Detection
                ├─► 3. Approved Container Catalog Whitelist Verification
                ├─► 4. Port Bounds Verification (1 <= port <= 65535)
                ├─► 5. Edge Source & Target Referential Integrity
                ├─► 6. Duplicate Edge & Self-Loop Detection
                ├─► 7. Secret Heuristic Scanner (Flags plaintext credentials)
                └─► 8. DFS Cycle Detection & Semantic Protocol Analysis
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
    Synchronous Cycles              Asynchronous Cycles
  (HTTP / gRPC)                   (AMQP / event-driven)
  Warning: Potential Deadlock     Warning: Event Loop Advisory
  (Non-blocking advisory)         (Valid, is_valid remains True)
```

### Validation Error Codes

| Code | Severity | Description |
|---|---|---|
| `EMPTY_TOPOLOGY` | ERROR | Topology must contain at least 1 node. |
| `INVALID_NODE_ID` | ERROR | Node ID does not conform to RFC 1123 DNS subdomain format. |
| `DUPLICATE_NODE_ID` | ERROR | Two nodes share identical unique IDs. |
| `DUPLICATE_NODE_NAME` | ERROR | Two nodes share identical human-readable names. |
| `UNAPPROVED_IMAGE` | ERROR | Image is not present in approved container catalog. |
| `INVALID_PORT` | ERROR | Port number outside 1–65535 or replicas < 1. |
| `SELF_LOOP_DETECTED` | ERROR | Node has a directed edge pointing to itself. |
| `DUPLICATE_EDGE` | ERROR | Multiple identical directed edges connect the same source and target. |
| `INVALID_EDGE_SOURCE` | ERROR | Edge references a non-existent source node. |
| `INVALID_EDGE_TARGET` | ERROR | Edge references a non-existent target node. |
| `CYCLIC_DEPENDENCY_DETECTED` | WARNING | Synchronous dependency cycle detected (potential deadlock). |
| `ASYNC_EVENT_CYCLE_DETECTED`| WARNING | Asynchronous messaging cycle detected (advises idempotency). |
| `PLAINTEXT_SECRET_WARNING` | WARNING | Environment variable appears to store unmasked secret keys. |

---

## 5. Optimistic Concurrency Control & Version History

To safeguard against race conditions when multiple platform engineers or SREs view and edit topologies simultaneously, `TopologyService` enforces optimistic concurrency locking:

```python
# Save payload contract
class TopologyUpdatePayload(BaseModel):
    name: Optional[str] = None
    nodes: List[TopologyNode]
    edges: List[TopologyEdge]
    groups: List[TopologyGroup] = []
    expected_version: int  # Must match current database version
```

### Execution Flow:
1. Client fetches topology version `N`.
2. When client saves mutations, it sends `expected_version = N`.
3. If database version is `N`:
   - Topology is updated to `version = N + 1`.
   - An immutable snapshot record is stored in `topology_versions` table with timestamp and author.
   - Response returns updated topology with version `N + 1`.
4. If database version is already `> N` (another user saved changes concurrently):
   - Server immediately aborts and returns `HTTP 409 Conflict` with detail: `"Topology version conflict. Expected version N, but current version is M. Please refresh."`

### Snapshot History & Revert:
- `GET /api/v1/topologies/{id}/versions` returns complete audit history of snapshots.
- `POST /api/v1/topologies/{id}/revert?target_version=K` rolls back the graph definition to version `K`, creating a new version `N + 1` representing the rollback state.

---

## 6. M3 Kubernetes Sandbox Deployment Translation

When an operator deploys a validated topology into an active M3 `READY` sandbox (`POST /api/v1/topologies/{id}/deploy`), `TopologyService.deploy_topology_to_sandbox` synthesizes zero-YAML Kubernetes resources directly into the sandbox namespace (`sandbox-{tenant_slug}-{uuid}`).

### 1. Workload Deployment Synthesis:
For each `TopologyNode`:
- A Kubernetes `apps/v1` `Deployment` is created.
- Injected with two containers:
  1. **Application Container**:
     - Image: verified from catalog.
     - Port: `8081` (or configured `container_port`).
     - Resources: CPU/memory request and limit enforced.
     - Liveness / Readiness Probes: HTTP health checks mapped to `/health`.
  2. **Toxiproxy Chaos Sidecar**:
     - Image: `ghcr.io/shopify/toxiproxy:2.9.0`
     - Proxy Port: `8080` (intercepts ingress and proxies to application container port `8081`).
     - Admin API Port: `8474` (for dynamic chaos latency/jitter/bandwidth injection).

### 2. ClusterIP Service Synthesis:
- A `v1/Service` with `type: ClusterIP` is generated for each node.
- Points port `8080` to the Toxiproxy proxy port on the deployment pods.
- Intra-cluster DNS name: `<service-name>.<namespace>.svc.cluster.local:8080`.

### 3. Verification & State Update:
- Workloads are registered on the `SandboxRecord.workloads` inventory.
- Sandbox lifecycle state is reaffirmed as `READY`.
- Client receives structured confirmation detailing deployed workloads and proxy endpoints.

---

## 7. Role-Based Access Control (RBAC) Enforcement

RBAC permissions established in M2 and M3 are strictly applied to all topology routes and UI operations:

| Role | Canvas View | Edit & Add Nodes | Save Graph | Version Rollback | Deploy to Sandbox |
|---|---|---|---|---|---|
| **TenantOwner** | Full Access | Allowed | Allowed | Allowed | Allowed |
| **Engineer** | Full Access | Allowed | Allowed | Allowed | Allowed |
| **Viewer** | View Only | Blocked | Blocked | Blocked | Blocked |

### UI Defensive Controls:
- For `Viewer` users, a prominent `VIEW ONLY` pill is rendered.
- Node palette buttons (`+ Service`, `+ Gateway`, etc.), `Save`, and `Deploy` buttons are conditionally unmounted.
- Canvas drag, node changes, and edge creation events are disabled in `onNodesChange` and `onConnect`.
- Backend endpoints return `403 Forbidden` if an unauthorized role issues mutations.

---

## 8. Automated Verification & Test Coverage

The M4 implementation is verified by a dual test suite:

1. **Backend Tests (`pytest` - 52/52 Passing)**:
   - `test_topology_validator.py`: Graph structural checks, RFC 1123 validation, duplicate ID rejection, port bounds, missing edge targets, secret detection, and DFS cycle classification.
   - `test_topology_service.py`: CRUD lifecycle, optimistic concurrency lock failure (409), snapshot generation, historical rollback, and Kubernetes deployment synthesis with Toxiproxy sidecars.
   - `test_topology_api.py`: REST router endpoints, RBAC permission denial for Viewer, and successful engineer deployments.

2. **Frontend Tests (`vitest` - 47/47 Passing across 10 suites)**:
   - `tests/topologyEditor.test.tsx`:
     - Renders canvas, status indicators, and node palette.
     - Adds new service nodes and updates unsaved indicator.
     - Opens validation drawer with cycle explanations.
     - Inspects snapshot versions and rollback modal.
     - Optimistic concurrency save with `expected_version` assertion.
     - Multi-step sandbox deployment into M3 `READY` sandboxes.
     - Viewer RBAC view-only restriction enforcement.
