# ChaosEngine AI — Local Kubernetes Development & Verification Guide

This guide describes how to run and verify ChaosEngine AI's dynamic sandbox provisioning engine using a local Kubernetes development cluster (Kind, Minikube, or Docker Desktop).

---

## 1. Prerequisites

Ensure the following tools are installed on your local machine:
- **Docker Engine / Docker Desktop** (v24.0+)
- **Kind** (Kubernetes in Docker) or **Minikube**
- **kubectl** (v1.28+)
- **Python 3.12+**
- **Node.js 20+** and **pnpm**

---

## 2. Setting Up a Local Kind Cluster

Kind provides a fast, lightweight Kubernetes cluster running as Docker containers.

### Step 1: Create a Kind Cluster Configuration
Save the following configuration as `kind-cluster.yaml`:

```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    extraPortMappings:
      - containerPort: 30080
        hostPort: 8080
        protocol: TCP
```

### Step 2: Provision the Cluster
```bash
kind create cluster --name chaosengine-dev --config kind-cluster.yaml
```

### Step 3: Verify Cluster Health & Context
```bash
kubectl cluster-info --context kind-chaosengine-dev
kubectl get nodes
```

Ensure your `~/.kube/config` (or `%USERPROFILE%\.kube\config` on Windows) is updated with the active context.

---

## 3. Configuring the Backend

### Step 1: Set Environment Variables
In `backend/.env`:

```env
# Kubernetes Integration
K8S_IN_CLUSTER=false
KUBECONFIG_PATH=C:/Users/<username>/.kube/config   # or ~/.kube/config on Linux/macOS
K8S_PROVISIONING_TIMEOUT_SECONDS=180
K8S_DEFAULT_TTL_HOURS=4

# JWT Authentication
SECRET_KEY=dev-secret-key-change-in-production-super-secure-key-32b
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

### Step 2: Install Python Dependencies
```bash
pip install -r backend/requirements.txt
```

### Step 3: Run the FastAPI Server
```bash
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

FastAPI will start at `http://localhost:8000`. You can inspect the OpenAPI documentation at:
- `http://localhost:8000/docs`
- `http://localhost:8000/api/v1/sandboxes`

---

## 4. Running the Frontend

### Step 1: Install Dependencies
```bash
pnpm install
```

### Step 2: Configure Environment
In `.env.development`:
```env
VITE_API_URL=http://localhost:8000/api/v1
VITE_USE_MOCK_DATA=false
```
*(Leave `VITE_USE_MOCK_DATA=true` if you wish to run with mock telemetry data without a live cluster).*

### Step 3: Start the Vite Dev Server
```bash
pnpm run dev
```

Navigate to `http://localhost:3000/sandboxes` in your browser.

---

## 5. End-to-End Verification Workflow

### Step 1: Provision a Sandbox via API
```bash
curl -X POST http://localhost:8000/api/v1/sandboxes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Idempotency-Key: test-run-001" \
  -d '{
    "name": "Local Verification Lab",
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "ttl_hours": 2,
    "resource_profile": {
      "profile_name": "standard",
      "cpu_request": "2",
      "cpu_limit": "4",
      "memory_request": "4Gi",
      "memory_limit": "8Gi",
      "max_pods": 20
    }
  }'
```

Expected HTTP Response: `202 Accepted` with a `Location: /api/v1/sandboxes/{sandbox_id}` header.

### Step 2: Inspect Kubernetes Resources with kubectl
Run:
```bash
# List dynamic sandbox namespaces
kubectl get namespaces -l chaosengine.io/managed-by=platform

# Inspect the sandbox's workloads
kubectl get deployments,services,pods -n <generated-namespace>

# Verify NetworkPolicy isolation
kubectl get networkpolicy -n <generated-namespace>
kubectl describe networkpolicy default-deny-isolate -n <generated-namespace>

# Verify ResourceQuota
kubectl get resourcequota -n <generated-namespace>
```

### Step 3: Verify Injected Toxiproxy Sidecars
Check that every pod contains 2 containers:
```bash
kubectl get pods -n <generated-namespace> -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{range .spec.containers[*]}{.name}{" "}{end}{"\n"}{end}'
```
Expected output:
```text
api-gateway-xxx       app toxiproxy-sidecar
order-service-xxx     app toxiproxy-sidecar
payment-service-xxx   app toxiproxy-sidecar
inventory-service-xxx app toxiproxy-sidecar
```

### Step 4: Verify Watchdog Reconciliation & Teardown
To trigger a teardown:
```bash
curl -X DELETE http://localhost:8000/api/v1/sandboxes/{sandbox_id} \
  -H "Authorization: Bearer <your-jwt-token>"
```
Verify that the namespace is deleted:
```bash
kubectl get namespace <generated-namespace>
# Output: Error from server (NotFound): namespaces "<generated-namespace>" not found
```
