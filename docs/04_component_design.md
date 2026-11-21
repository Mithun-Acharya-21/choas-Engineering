# Low-Level Component Design & Deep Dives

## 1. Architectural Patterns & Directory Structure

To ensure production-grade modularity, the platform follows Domain-Driven Design (DDD) principles structured as a clean modular monolith in Python 3.12:

```
src/
├── core/                   # Global configuration, security, database sessions, logging
│   ├── config.py           # Pydantic v2 BaseSettings
│   ├── security.py         # Argon2id hashing, JWT encode/decode
│   ├── database.py         # SQLAlchemy 2.x async engine & sessionmaker
│   └── redis.py            # Redis connection pool & distributed locks
├── domains/                # Autonomous business domains
│   ├── auth/               # Users, tenants, memberships, RBAC
│   ├── topology/           # Service definitions, dependency DAGs
│   ├── sandbox/            # Dynamic Kubernetes namespace & resource manager
│   ├── chaos/              # Experiment orchestration, Toxiproxy & stress clients
│   ├── observability/      # OTel, Prometheus & Jaeger integration clients
│   ├── incident/           # Alert evaluation, incident lifecycle & deduplication
│   ├── rca/                # Deterministic graph correlation & scoring algorithms
│   └── ai_explanation/     # LLM provider abstraction, prompts, schema validation
├── workers/                # Celery background tasks & schedules
│   ├── celery_app.py       # Celery instance configuration
│   ├── chaos_tasks.py      # Experiment run, duration enforcement, rollback
│   ├── sandbox_tasks.py    # Provisioning & async teardown
│   └── reconciler_tasks.py # Watchdog for leaked toxics & orphaned resources
└── api/                    # FastAPI routers, middleware, exception handlers
    ├── v1/                 # Versioned REST endpoints
    └── dependencies.py     # Auth, tenant context & DB session injection
```

---

## 2. Subsystem 1: Sandbox Manager

### 2.1 Modules, Classes, and Interfaces

```python
# Conceptual interface definition
class ISandboxManager(ABC):
    @abstractmethod
    async def provision_sandbox(self, sandbox_id: UUID, topology_id: UUID) -> SandboxProvisionResult: ...
    @abstractmethod
    async def teardown_sandbox(self, sandbox_id: UUID) -> None: ...
    @abstractmethod
    async def reconcile_sandboxes(self) -> ReconciliationReport: ...
```

- **`SandboxService` (`domains.sandbox.service`):** High-level orchestrator handling state transitions in PostgreSQL and dispatching async provisioning tasks.
- **`K8sManifestBuilder` (`domains.sandbox.k8s_builder`):** Pure functional builder converting `ServiceTopology` domain models into valid Kubernetes JSON/YAML manifests.
- **`K8sClientWrapper` (`domains.sandbox.k8s_client`):** Wraps `kubernetes_asyncio.client.CoreV1Api`, `AppsV1Api`, and `NetworkingV1Api` with retries, timeout handling, and structured logging.

### 2.2 Manifest Specifications & Security Invariants

When `provision_sandbox` executes for an e-commerce topology, it guarantees the creation of:
1. **Namespace:** `sandbox-{tenant_slug}-{short_uuid}`
   - Labels: `chaos-platform/tenant-id`, `chaos-platform/sandbox-id`, `pod-security.kubernetes.io/enforce: baseline`.
2. **ResourceQuota (`quota.yaml`):**
   ```yaml
   apiVersion: v1
   kind: ResourceQuota
   metadata:
     name: sandbox-quota
   spec:
     hard:
       requests.cpu: "4"
       requests.memory: 8Gi
       limits.cpu: "8"
       limits.memory: 16Gi
       pods: "25"
   ```
3. **LimitRange (`limits.yaml`):** Enforces default CPU (100m/500m) and memory (128Mi/512Mi) limits on containers that omit explicit specifications.
4. **NetworkPolicy (`default-deny-isolate.yaml`):**
   - Ingress: Allow traffic strictly from pods sharing the same `chaos-platform/sandbox-id` label.
   - Egress: Allow traffic inside namespace, DNS (port 53) to `kube-system`, and OTLP (port 4317) to the OpenTelemetry Collector in the control plane namespace. All other egress is strictly blocked.
5. **Workload Deployments with Injected Toxiproxy Sidecars:**
   Each microservice pod runs two containers:
   - `application`: The microservice (e.g., `order-service:1.0.0`), listening on internal localhost port `8081`.
   - `toxiproxy-sidecar`: Image `ghcr.io/shopify/toxiproxy:2.9.0`, exposing port `8080` (public service ingress) and port `8474` (Toxiproxy management API). Traffic directed to `order-service:8080` passes through Toxiproxy before being proxied to `localhost:8081`.

### 2.3 Deletion and Reconciliation
- **Teardown Lifecycle:**
  1. Set sandbox status in DB to `TERMINATING`.
  2. Send Kubernetes API call: `delete_namespace(name=ns_name, propagation_policy="Foreground")`.
  3. Poll until namespace is completely deleted (up to 60s).
  4. Set sandbox status to `DELETED`.
- **Reconciliation Watchdog (Celery Beat runs every 2 minutes):**
  - Queries active namespaces with label `chaos-platform/sandbox-id`.
  - Compares with PostgreSQL database records.
  - If a namespace exists in Kubernetes whose sandbox record is `DELETED` or older than the maximum TTL (default: 4 hours), the reconciler issues an immediate garbage collection teardown.

---

## 3. Subsystem 2: Chaos Experiment Engine

### 3.1 Modules and Interfaces

```python
class IChaosEngine(ABC):
    @abstractmethod
    async def start_experiment(self, experiment_id: UUID, run_id: UUID) -> None: ...
    @abstractmethod
    async def stop_experiment(self, run_id: UUID, reason: str) -> None: ...
    @abstractmethod
    async def verify_steady_state(self, run_id: UUID) -> bool: ...
```

- **`ExperimentRunner` (`domains.chaos.runner`):** Orchestrates the multi-stage execution lifecycle: `INITIALIZING` $\to$ `STEADY_STATE_VERIFY` $\to$ `INJECTING` $\to$ `RUNNING` $\to$ `RECOVERING` $\to$ `COMPLETED`.
- **`ToxiproxyClient` (`domains.chaos.toxiproxy`):** High-performance async client for the Toxiproxy HTTP API (creates, inspects, and deletes toxics: `latency`, `jitter`, `bandwidth`, `slow_close`, `slice`).
- **`StressManager` (`domains.chaos.stress`):** Manages CPU and memory saturation experiments via ephemeral containers using `stress-ng`.

### 3.2 The Fault Lifecycle & Duration Enforcement
1. **Validation & Reservation:**
   - Verify that the target service exists within the target sandbox.
   - Acquire a distributed Redis lease: `lock:experiment:sandbox:{sandbox_id}` with TTL = experiment duration + 30s. This guarantees that only **one active experiment** can run per sandbox simultaneously.
2. **Steady-State Verification:**
   - Query Prometheus for the last 60 seconds of metrics.
   - Verify that error rate is $< 1\%$ and P99 latency is within normal thresholds. If the service is already degraded, abort the experiment immediately with reason `PRE_EXISTING_DEGRADATION`.
3. **Fault Injection (e.g., Network Latency):**
   ```python
   # HTTP POST to http://order-service-toxiproxy:8474/proxies/payment_downstream/toxics
   payload = {
       "name": f"latency_toxic_{run_id}",
       "type": "latency",
       "stream": "downstream",
       "toxicity": 1.0,
       "attributes": {
           "latency": 2000,   # 2000ms injected delay
           "jitter": 300      # 300ms random variation
       }
   }
   ```
4. **Duration Enforcement & Heartbeats:**
   - The Celery worker enters a controlled sleep/polling loop in 5-second increments.
   - At each increment, the worker updates a Redis key `heartbeat:experiment:{run_id}`.
   - Checks if a cancellation flag has been set in Redis by the user (`stop_experiment`).
5. **Safe Fault Removal (Rollback):**
   - Issues `DELETE http://.../proxies/payment_downstream/toxics/latency_toxic_{run_id}`.
   - Queries Toxiproxy to verify the toxic count is 0.
   - Polls Prometheus for 15 seconds to confirm latency returns to baseline.

### 3.3 Recovery After Worker Crashes
If a Celery worker dies (`SIGKILL`, kernel OOM, node reboot) while a fault is active:
- The Redis heartbeat `heartbeat:experiment:{run_id}` expires after 15 seconds.
- A dedicated **Watchdog Worker** (`workers.reconciler_tasks.sweep_stale_experiments`) wakes up every 10 seconds:
  1. Identifies any `ExperimentRun` marked as `RUNNING` whose heartbeat has expired.
  2. Queries the target pod's Toxiproxy API directly and issues an emergency toxic flush.
  3. Updates the `ExperimentRun` record to `FAILED` with failure reason `WORKER_CRASH_AUTO_RECOVERED`.
  4. Releases the distributed Redis lock.

---

## 4. Subsystem 3: Observability Engine

### 4.1 Architecture and Instrumentation Standards
All microservices deployed into sandboxes are instrumented using the OpenTelemetry SDK (Python, Node.js, or Go):
- **Traces:** Injected into HTTP headers using W3C Trace Context standards (`traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`).
- **Metrics:** Exposing Prometheus metrics at `/metrics`:
  - `http_server_duration_milliseconds_bucket` (Histogram)
  - `http_server_requests_total{status, method, path}` (Counter)
  - `http_server_active_requests` (Gauge)
- **Metadata Attributes:** Automatically injected into all spans and metrics via OTel Resource Detectors:
  - `service.name`: e.g., `order-service`
  - `service.version`: e.g., `1.2.0`
  - `chaos.tenant_id`: e.g., `tenant-alpha`
  - `chaos.sandbox_id`: e.g., `sb-789`

### 4.2 OpenTelemetry Collector Pipeline Configuration
The OTel Collector is deployed in the platform namespace with the following pipeline:
```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  memory_limiter:
    check_interval: 1s
    limit_percentage: 80
    spike_limit_percentage: 20
  batch:
    send_batch_size: 1024
    timeout: 1s
  transform:
    error_mode: ignore
    metric_statements:
      - context: metric
        statements:
          - set(attributes["environment"], "chaos-sandbox")

exporters:
  prometheus:
    endpoint: 0.0.0.0:8889
    namespace: "chaos"
  otlp/jaeger:
    endpoint: "jaeger-collector:4317"
    tls:
      insecure: true
  loki:
    endpoint: "http://loki:3100/loki/api/v1/push"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [otlp/jaeger]
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, transform, batch]
      exporters: [prometheus]
```

---

## 5. Subsystem 4: Incident Detection Engine

### 5.1 Alert Ingestion and Metric Evaluation
The Incident Detection Engine evaluates sliding-window PromQL queries every 5 seconds during active experiments:
- **Rule 1 (Latency Spike):**
  ```promql
  histogram_quantile(0.99, sum(rate(chaos_http_server_duration_milliseconds_bucket{sandbox_id="$SANDBOX_ID"}[30s])) by (le, service_name)) > 500
  ```
- **Rule 2 (Error Rate Spike):**
  ```promql
  sum(rate(chaos_http_server_requests_total{status=~"5..", sandbox_id="$SANDBOX_ID"}[30s])) 
  / 
  sum(rate(chaos_http_server_requests_total{sandbox_id="$SANDBOX_ID"}[30s])) > 0.05
  ```

### 5.2 Deduplication and Incident Grouping
When multiple interconnected services breach thresholds simultaneously:
1. **Grouping Window:** When an alert fires at timestamp $T_0$, an Incident window of 60 seconds opens.
2. **Correlation Key:** Any alerts firing within that window sharing the same `sandbox_id` and overlapping upstream/downstream dependency paths are grouped into the **same** `Incident` instance rather than creating separate incident alerts.
3. **State Machine:**
   `DETECTED` $\to$ `EVALUATING` $\to$ `ANALYZED` $\to$ `RESOLVED`.

---

## 6. Subsystem 5: Root Cause Analysis (RCA) Engine

### 6.1 Deterministic Algorithmic Formulation

The deterministic RCA engine does not rely on text generation. It computes candidate root cause scores using a multi-factor mathematical formulation:

$$\text{Score}(S_i) = w_1 \cdot \mathcal{T}(S_i) + w_2 \cdot \mathcal{S}(S_i) + w_3 \cdot \mathcal{D}(S_i) + w_4 \cdot \mathcal{A}(S_i)$$

Where weights are normalized ($\sum w_k = 1.0$, default configuration: $w_1=0.35, w_2=0.30, w_3=0.20, w_4=0.15$):

1. **$\mathcal{T}(S_i)$ — Temporal Precedence Score:**
   - Identifies the earliest timestamp $t_{\text{breach}}(S)$ where metrics deviated $> 3\sigma$ from baseline.
   - The service that degraded first receives $\mathcal{T} = 1.0$. Services degrading subsequently receive exponentially decaying scores based on time delta $\Delta t = t_{\text{breach}}(S_i) - t_{\text{first}}$:
     $$\mathcal{T}(S_i) = e^{-\lambda \Delta t}$$
2. **$\mathcal{S}(S_i)$ — Distributed Trace Span Self-Time Ratio:**
   - Evaluates traces exhibiting `HTTP 5xx` or timeout errors.
   - For each trace tree, calculates "Self-Time" vs. "Child Wait Time".
   - If `order-service` span duration is 2100ms, but 2050ms was spent waiting for `payment-service` child span, `order-service` receives a low self-time ratio ($\approx 0.02$), while `payment-service` receives a high self-time ratio ($\approx 0.98$).
3. **$\mathcal{D}(S_i)$ — Topological Dependency Graph Centrality:**
   - Traverses the Directed Acyclic Graph (DAG). Downstream leaf services or dependency sinks that upstream nodes block upon receive higher causal weight than edge gateways.
4. **$\mathcal{A}(S_i)$ — Metric Anomaly Magnitude (Z-Score):**
   - Measures the relative statistical deviation of latency and error rates against steady-state baseline:
     $$Z = \frac{\mu_{\text{chaos}} - \mu_{\text{baseline}}}{\sigma_{\text{baseline}}}$$

### 6.2 Evidence Tracking & Candidate Ranking
The engine ranks all nodes in the topology and outputs a structured **Evidence Pack**:
```json
{
  "incident_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "analysis_window": {"start": "2026-11-18T12:00:00Z", "end": "2026-11-18T12:03:00Z"},
  "ranked_candidates": [
    {
      "service_name": "payment-service",
      "confidence_score": 0.94,
      "factors": {
        "temporal_precedence_rank": 1,
        "earliest_anomaly_timestamp": "2026-11-18T12:00:15Z",
        "trace_self_time_ratio": 0.97,
        "metric_z_score": 14.2
      },
      "causal_classification": "ROOT_CAUSE"
    },
    {
      "service_name": "order-service",
      "confidence_score": 0.41,
      "factors": {
        "temporal_precedence_rank": 2,
        "earliest_anomaly_timestamp": "2026-11-18T12:00:22Z",
        "trace_self_time_ratio": 0.03,
        "metric_z_score": 8.1
      },
      "causal_classification": "DOWNSTREAM_SYMPTOM"
    }
  ],
  "supporting_trace_ids": ["4bf92f3577b34da6a3ce929d0e0e4736"]
}
```

---

## 7. Subsystem 6: AI Explanation Engine

### 7.1 Provider Abstraction & Pydantic Schema Validation

The AI engine uses an abstract provider interface allowing hot-swapping between Groq, local models (vLLM/Ollama), and OpenAI:

```python
class ILLMProvider(ABC):
    @abstractmethod
    async def generate_structured_rca(self, prompt: str, schema: type[BaseModel]) -> BaseModel: ...

class GroqLLMProvider(ILLMProvider):
    def __init__(self, api_key: str, model: str = "llama-3-70b-8192"):
        self.client = AsyncGroq(api_key=api_key)
        self.model = model
        
    async def generate_structured_rca(self, prompt: str, schema: type[BaseModel]) -> BaseModel:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.1  # Low temperature for deterministic output
        )
        return schema.model_validate_json(response.choices[0].message.content)
```

### 7.2 Strict Pydantic Output Schema
```python
class RootCauseExplanationSchema(BaseModel):
    executive_summary: str = Field(description="2-3 sentence high-level summary of what occurred.")
    primary_root_cause: str = Field(description="Identified service and failure mechanism.")
    causal_propagation_chain: list[str] = Field(description="Step-by-step propagation from origin to edge.")
    evidence_justification: list[str] = Field(description="Direct references to telemetry facts from the Evidence Pack.")
    remediation_recommendations: list[str] = Field(description="Concrete engineering fixes (timeouts, circuit breakers).")
```

### 7.3 Hallucination Detection & Verification
Before an LLM explanation is accepted and stored:
1. **Entity Extraction Check:** Parse all service names mentioned in `primary_root_cause` and `causal_propagation_chain`. Verify that $100\%$ of extracted service names exist in the topology.
2. **Metric Verification Check:** If the LLM asserts "latency increased to 2000ms", verify that 2000ms is present in the Evidence Pack metrics.
3. If verification fails, the system logs an audit warning, rejects the LLM output, and stores the deterministic explanation as the primary narrative.

---

## 8. Educational Deep-Dive & System Design Questions

### Subsystem Deep-Dive 1: Sandbox Manager & Kubernetes Isolation
1. **What problem does it solve?** It automates the provisioning of secure, isolated, ephemeral Kubernetes environments for multi-tenant chaos testing.
2. **Why do we need it?** Without automated sandboxing, engineers would either run dangerous tests in shared staging environments (impacting other developers) or have to manually write Kubernetes manifests.
3. **How does it work internally?** It takes a declarative topology DAG, compiles it into Kubernetes manifests with injected sidecars, creates a designated namespace, applies `ResourceQuota` and `NetworkPolicy`, and watches until pods are ready.
4. **How does it communicate with other components?** Communicates with Kubernetes API server via `kubernetes_asyncio` and updates state in PostgreSQL.
5. **What alternatives exist?** Virtual Machines per tenant (too slow, high cost), vCluster (good, but heavier overhead than pure namespaces), shared staging namespaces (zero security isolation).
6. **Why did we select this implementation?** Kubernetes namespaces with `ResourceQuota` and `NetworkPolicy` provide the optimal balance of sub-minute spin-up speed, lightweight resource overhead, and strong network isolation.
7. **What can go wrong?** Pods get stuck in `Pending` due to cluster capacity exhaustion; namespace deletion hangs due to finalizers.
8. **How do we test it?** Integration tests using Testcontainers running a localized Kind (Kubernetes in Docker) cluster.
9. **What trade-offs did we accept?** Namespaces share the underlying host Linux kernel. This is logical isolation, not a hardware virtualization boundary.
10. **Interview Question:** *"How do you prevent a malicious or misconfigured tenant sandbox from starving other tenants of CPU and memory on a shared Kubernetes cluster?"*
    - **Answer:** We enforce a defense-in-depth model: (1) `ResourceQuota` caps total CPU/memory allocatable in the namespace; (2) `LimitRange` ensures every container has explicit request/limit caps; (3) Linux cgroups enforce CPU bandwidth throttling and memory hard limits at the kernel level.

### Subsystem Deep-Dive 2: Chaos Engine & Toxiproxy
1. **What problem does it solve?** Precisely injects network degradation (latency, jitter, bandwidth) into specific inter-service links.
2. **Why do we need it?** Kernel-level packet drops (e.g., raw `iptables`) often require root privileges and can leak onto the host node. Toxiproxy operates in user-space at layer 7/4 with sub-second API control.
3. **How does it work internally?** Injects a sidecar into the pod. Application traffic is routed through the proxy socket. Toxiproxy manipulates TCP stream buffers to simulate delays and drops.
4. **How does it communicate?** Control plane Celery workers make HTTP REST calls directly to the Toxiproxy management port (`8474`).
5. **What alternatives exist?** Chaos Mesh, LitmusChaos (both require high-privilege cluster CRDs and kernel daemonsets), Istio Fault Injection (requires heavy service mesh control plane).
6. **Why did we select this implementation?** Toxiproxy is lightweight, runs without root privileges (`CAP_NET_ADMIN` not required), is completely self-contained within the pod, and provides predictable API rollback.
7. **What can go wrong?** Celery worker crashes mid-experiment, leaving the toxic active indefinitely.
8. **How do we test it?** Unit tests with mocked HTTP clients, and end-to-end chaos tests verifying packet delay using synthetic client latency measurements.
9. **What trade-offs did we accept?** User-space proxying introduces $\sim 1\text{ms}$ of baseline overhead compared to eBPF/kernel injection.
10. **Interview Question:** *"If the worker executing a chaos experiment crashes abruptly, how do you guarantee that injected faults do not permanently degrade the service?"*
    - **Answer:** We employ distributed heartbeats in Redis and an out-of-band watchdog worker. If the owning worker fails to refresh its heartbeat within 15 seconds, the watchdog triggers an automated emergency cleanup, querying the Toxiproxy sidecar API and clearing all active toxics.

### Subsystem Deep-Dive 3: Deterministic RCA Engine
1. **What problem does it solve?** Identifies the true root cause in cascading microservice failures where upstream services report severe symptoms.
2. **Why do we need it?** In distributed systems, upstream callers (e.g., API Gateway) often crash or timeout due to slow downstream dependencies. Relying on simple error counts wrongly blames the gateway.
3. **How does it work internally?** Traverses the topology graph, measures metric anomaly onset timestamps (temporal precedence), and calculates self-time ratios across distributed trace trees.
4. **How does it communicate?** Reads topology from PostgreSQL, queries metrics from Prometheus, and queries trace spans from Jaeger.
5. **What alternatives exist?** Pure LLM prompt analysis (prone to hallucinations and token context limits), Bayesian networks, static rule-based alerting trees.
6. **Why did we select this implementation?** Deterministic scoring based on graph theory and trace tree decomposition is explainable, mathematically reproducible, sub-second fast, and immune to generative hallucinations.
7. **What can go wrong?** Traces are sampled or dropped, resulting in incomplete call trees.
8. **How do we test it?** Deterministic replay tests using recorded telemetry fixtures of simulated outages (e.g., our e-commerce payment delay scenario).
9. **What trade-offs did we accept?** Requires comprehensive OpenTelemetry instrumentation across services to achieve high accuracy.
10. **Interview Question:** *"Why should root cause analysis in distributed systems be deterministic rather than purely driven by Large Language Models?"*
    - **Answer:** Distributed telemetry consists of high-volume, structured relational data (graphs, timestamps, histograms). LLMs are non-deterministic, have limited context windows, lack native graph-traversal execution capabilities, and frequently mistake symptoms for causes. A deterministic engine computes mathematical ground truth; the LLM should be reserved for human language synthesis and runbook formatting.
