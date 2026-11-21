# Product Requirements Document (PRD)

## 1. Executive Summary & Document Control

| Attribute | Details |
| :--- | :--- |
| **Product Name** | ChaosEngine AI (AI Root Cause Analysis & Chaos Engineering Platform) |
| **Document Version** | 1.0.0-PROPOSED |
| **Author** | Platform Engineering & Architecture Team |
| **Status** | Milestone 1 Architecture Baseline |
| **Target Delivery** | Incremental Milestones (M0 - M12) |

---

## 2. System Constraints

1. **SC-001 (Control Plane Simplicity):** The platform control plane must be deployed as a single modular application (FastAPI backend + Next.js frontend) rather than a premature microservice mesh. Distributed components are reserved exclusively for execution workers and target sandbox workloads.
2. **SC-002 (Host & Cluster Protection):** The platform operates within a shared or local Kubernetes cluster (Kind for development, managed Kubernetes for production). Control plane services must be completely insulated from chaos fault injection.
3. **SC-003 (Deterministic Primacy):** Large Language Models (LLMs) must **never** be the primary detection or correlation engine. LLMs are strictly downstream consumers of structured evidence produced by the deterministic graph and statistical correlation engine.
4. **SC-004 (Stateless Workers):** Background experiment workers (Celery) must remain completely stateless. All transient state, heartbeats, and locks must be held in Redis; all durable state must reside in PostgreSQL.
5. **SC-005 (Telemetry Segregation):** Time-series metrics and distributed trace spans must never be stored directly in PostgreSQL relational tables. PostgreSQL stores only metadata, experiment runs, incidents, evidence summaries, and reports. Metrics reside in Prometheus; traces reside in Jaeger; logs reside in Loki.

---

## 3. Scope Boundaries

### 3.1 In-Scope for MVP (Milestone Baseline)
- Multi-tenant data segregation with role-based access control (Admin, Member, Viewer).
- Declarative service topology definition (nodes, services, synchronous/asynchronous dependencies).
- Automated provisioning and tearing down of isolated Kubernetes sandbox namespaces with strict `ResourceQuota`, `LimitRange`, and `NetworkPolicy`.
- Deployment of a reference 6-tier e-commerce microservice suite instrumented with OpenTelemetry.
- Chaos fault injection: Network Latency, Network Jitter, Packet Drop, Bandwidth Throttling (via Toxiproxy sidecars), and Pod Kill / Stress (via Kubernetes API / cgroup stress containers).
- Telemetry ingestion pipeline: OpenTelemetry Collector forwarding to Prometheus, Jaeger, and Loki.
- Automated threshold-based and rate-of-change incident detection.
- Deterministic graph-based Root Cause Analysis (combining topology traversal, trace span duration attribution, and anomaly timestamps).
- Evidence-grounded AI incident explanation and mitigation runbook generation using Groq / compatible LLMs with strict Pydantic JSON schemas.
- Incident post-mortem report export in Markdown and printable/downloadable format.

### 3.2 Future Scope (Post-MVP Enhancements)
- Multi-cluster Kubernetes support across public cloud providers (EKS, GKE, AKS).
- Automated regression testing integrated into CI/CD pipelines (GitHub Actions chaos gate).
- Advanced eBPF-based fault injection (e.g., simulating Linux kernel filesystem I/O errors or TCP socket drops without proxies).
- Automated closed-loop chaos self-healing (triggering Kubernetes auto-scaling or automated rollback scripts).
- Support for asynchronous event-driven topologies involving Apache Kafka and RabbitMQ.

### 3.3 Explicitly Excluded Features
- **Arbitrary Shell Execution:** No tenant or user is permitted to supply arbitrary bash/shell scripts to execute on the Kubernetes cluster or within running containers.
- **Production Cluster Destruction:** The platform will strictly prohibit targeting namespaces outside of the designated sandbox namespace pattern (`sandbox-{tenant_id}-{sandbox_id}`).
- **Direct Database Modification of Managed Stores:** Chaos injection against persistent volumes or raw disk destruction is excluded to prevent data corruption outside of isolated sandbox ephemeral volumes.

---

## 4. Functional Requirements (FR)

### 4.1 Authentication & Multi-Tenancy
- **FR-001:** The system shall allow users to register an account with email, password (hashed using Argon2id/bcrypt), and full name.
- **FR-002:** The system shall authenticate users via OAuth2 Password Bearer flow, issuing signed short-lived JWT access tokens (15-minute expiration) and secure HTTP-only refresh tokens (7-day expiration).
- **FR-003:** The system shall support multi-tenancy where all resources (projects, sandboxes, experiments, incidents, reports) are strictly partitioned by `tenant_id`.
- **FR-004:** The system shall support Role-Based Access Control (RBAC) with three distinct roles: `TenantOwner`, `Engineer` (can execute experiments and provision), and `Viewer` (read-only access to topologies, telemetry, and reports).

### 4.2 Project & Topology Management
- **FR-005:** Users shall be able to create, list, inspect, update, and delete Projects within their tenant.
- **FR-006:** Users shall be able to define declarative Microservice Topologies containing service nodes, container images, port configurations, environment variables, and directional dependency edges (`Service A` $\to$ `Service B`, specifying protocol `HTTP/gRPC/AMQP` and call type `synchronous/asynchronous`).
- **FR-007:** The system shall validate topology DAGs (Directed Acyclic Graphs) and detect cyclical synchronous dependencies that represent anti-patterns.

### 4.3 Kubernetes Sandbox Management
- **FR-008:** The system shall provision an isolated Kubernetes namespace for a given project topology on demand (`sandbox-{tenant_short_id}-{sandbox_uuid}`).
- **FR-009:** The system shall automatically inject a default-deny `NetworkPolicy` into the sandbox namespace, allowing only intra-namespace service traffic and telemetry egress to the OpenTelemetry Collector.
- **FR-010:** The system shall apply a `ResourceQuota` (e.g., max 4 CPU cores, 8GiB RAM, 20 Pods) and a `LimitRange` to prevent sandbox workloads from monopolizing the host cluster.
- **FR-011:** The system shall deploy the topology microservices as Kubernetes `Deployments` and `Services`, injecting a Toxiproxy sidecar container alongside each microservice container.
- **FR-012:** The system shall support clean, asynchronous teardown of sandboxes, deleting all associated Kubernetes resources (deployments, pods, services, network policies, secrets) and releasing resources within a maximum grace period.

### 4.4 Chaos Engineering & Fault Injection
- **FR-013:** Users shall be able to configure chaos experiments specifying: target sandbox, target service/dependency, fault type (`latency`, `jitter`, `packet_loss`, `bandwidth_limit`, `pod_failure`, `cpu_stress`, `memory_stress`), parameters (e.g., latency duration in milliseconds), and experiment duration (in seconds, bounded by maximum limits).
- **FR-014:** The system shall validate that target services exist within the designated sandbox and that experiment parameters fall within safety envelopes.
- **FR-015:** The system shall execute chaos experiments asynchronously via Celery background workers, ensuring non-blocking API operation.
- **FR-016:** For network faults, the system shall interact with the target pod's Toxiproxy sidecar via its HTTP API to activate the designated "toxic".
- **FR-017:** For compute stress faults, the system shall deploy an ephemeral, quota-bounded stress container or leverage native cgroup stress mechanisms within the sandbox.
- **FR-018:** The system shall provide an explicit, idempotent `POST /experiments/{id}/stop` endpoint (Kill Switch) that immediately removes all active toxics, terminates stress workloads, and marks the experiment as aborted.
- **FR-019:** The system shall enforce automatic experiment timeout: when the configured duration expires, background workers must automatically revoke faults and verify that the system has returned to normal operating parameters.

### 4.5 Observability & Telemetry Pipeline
- **FR-020:** The system shall ingest OpenTelemetry traces from all sandbox microservices, ensuring trace context propagation headers (`traceparent`, `tracestate`) are preserved across service boundaries.
- **FR-021:** The system shall scrape Prometheus metrics from all microservice endpoints (HTTP request duration, request count, error count, active connections) and Kubernetes container cgroup metrics (CPU usage, memory usage).
- **FR-022:** The system shall correlate all telemetry streams with standard contextual tags: `tenant_id`, `project_id`, `sandbox_id`, `service_name`, and `experiment_run_id`.
- **FR-023:** The system shall provide API endpoints to query recent metric time series (P50, P95, P99 latency, RPS, 5xx error rate) and distributed traces for a specific sandbox and time window.

### 4.6 Incident Detection & Deterministic RCA
- **FR-024:** The system shall continuously evaluate incident trigger rules during an active experiment run (e.g., P99 latency > 500ms for $\ge 30$ seconds, or error rate > 5%).
- **FR-025:** When a threshold is violated, the system shall automatically create an `Incident` entity in the database, capture an `Incident Evidence Pack`, and link it to the running experiment.
- **FR-026:** The Deterministic RCA Engine shall execute an automated correlation pipeline:
  1. Retrieve the service topology dependency graph.
  2. Query Prometheus for metric anomaly start times across all topology nodes.
  3. Query Jaeger for trace spans exhibiting errors (`status.code == ERROR`) and anomalous latency durations during the incident window.
  4. Perform topological traversal from alerting symptom nodes down to origin dependency nodes.
  5. Calculate a normalized Root Cause Confidence Score ($0.00 - 1.00$) for each candidate service.
- **FR-027:** The system shall record candidate causes, supporting evidence (trace IDs, metric time series snapshots, logs), and alternative hypotheses in the database.

### 4.7 AI Explanation & Report Generation
- **FR-028:** The AI Explanation Engine shall accept the structured `Incident Evidence Pack` from the Deterministic RCA Engine and build a strictly constrained prompt.
- **FR-029:** The system shall query an LLM provider (Groq API or OpenAI-compatible endpoint) requesting a validated, structured JSON response conforming to a strict Pydantic schema.
- **FR-030:** The system shall prevent AI hallucinations by validating that every service, metric value, and timestamp cited in the LLM response exists in the provided Evidence Pack. If validation fails, the response is rejected and regenerated or flagged.
- **FR-031:** The system shall generate a comprehensive Root Cause Analysis (RCA) Post-Mortem Report containing: Executive Summary, Incident Timeline, Causal Propagation Chain, Supporting Telemetry Artifacts, and Concrete Remediation Steps.
- **FR-032:** Users shall be able to download the complete RCA report in Markdown or rendered PDF format.

---

## 5. Non-Functional Requirements (NFR)

*Note: All numerical targets below represent proposed engineering baselines for architecture and sizing, to be formally validated during benchmarking milestones.*

| ID | Category | Requirement Description | Proposed Target Metric |
| :--- | :--- | :--- | :--- |
| **NFR-001** | Multi-Tenant Security | Strict logical data separation across all database queries; zero data leakage between tenants. | Zero cross-tenant data leakage verified via automated integration test suite. |
| **NFR-002** | Sandbox Isolation | Sandbox workloads must not be capable of accessing the Kubernetes control plane or neighboring tenant sandboxes. | All cross-namespace traffic blocked via default-deny `NetworkPolicy`; cluster API blocked from pods. |
| **NFR-003** | API Latency | Control plane REST API read endpoints must respond quickly under standard loads. | Proposed Target: P95 $< 100\text{ms}$, P99 $< 250\text{ms}$ under 100 concurrent users. |
| **NFR-004** | Experiment Kill-Switch | Immediate termination of all injected faults upon operator cancellation or experiment timeout. | Proposed Target: Fault removal executed and verified within $\le 3\text{ seconds}$ of trigger. |
| **NFR-005** | Sandbox Provisioning Time | Total time to provision a complete 6-service Kubernetes namespace with sidecars and network policies. | Proposed Target: Fully ready in $\le 45\text{ seconds}$ (assuming container images cached locally). |
| **NFR-006** | Telemetry Ingestion Freshness | Delay between telemetry emission inside sandbox and availability for incident detection query. | Proposed Target: Metric scraping interval $\le 5\text{s}$; trace ingestion latency $\le 3\text{s}$. |
| **NFR-007** | RCA Execution Duration | Time required for the Deterministic RCA engine to correlate metrics, traces, and topology graphs. | Proposed Target: Algorithmic analysis completes in $\le 5\text{ seconds}$ for a 10-node topology. |
| **NFR-008** | AI Explanation Generation | Round-trip latency for LLM prompt generation, inference via Groq, and schema validation. | Proposed Target: Total generation time $\le 8\text{ seconds}$ using high-throughput Groq inference. |
| **NFR-009** | System Availability | Platform control plane uptime excluding scheduled maintenance. | Proposed Target: 99.9% availability for API and background workers. |
| **NFR-010** | Safe Failure Recovery | Platform control plane recovery after sudden worker crash or database reconnection. | Automatic worker task reconciliation within 60s; zero orphaned toxics left active in cluster. |

---

## 6. Comprehensive User Stories (14 Core Flows)

### US-001: User Registration and Authentication
- **As a** DevOps Engineer,
- **I want to** register an account using my corporate email and log in securely,
- **So that** I can obtain an authenticated session to manage my resilience experiments.
- **Acceptance Criteria:**
  - Password must be at least 10 characters with uppercase, lowercase, numbers, and symbols.
  - Successful registration creates an initial personal Tenant and assigns the user as `TenantOwner`.
  - Authentication returns an access JWT and an HTTP-only refresh cookie.

### US-002: Tenant Creation and Member Invitation
- **As an** Engineering Lead,
- **I want to** create a dedicated organization Tenant and invite team members with specific roles (`Engineer`, `Viewer`),
- **So that** my entire engineering group can collaborate in a segregated workspace.
- **Acceptance Criteria:**
  - Unique slug generated for the tenant.
  - RBAC permissions strictly enforced across tenant membership.
  - Non-members receive `403 Forbidden` when attempting to access tenant resources.

### US-003: Project Creation
- **As an** SRE,
- **I want to** create a Project (e.g., "E-Commerce Checkout Resilience") within my tenant,
- **So that** I can group related service topologies, sandboxes, and experiment campaigns.
- **Acceptance Criteria:**
  - Project contains name, description, tags, and tenant foreign key.
  - Audit log entry generated upon project creation.

### US-004: Service Topology Creation
- **As a** Microservice Architect,
- **I want to** define a visual and declarative topology representing my microservices and their dependencies,
- **So that** the platform knows which services talk to which and can construct a dependency graph.
- **Acceptance Criteria:**
  - Support nodes: Service Name, Docker Image, Ingress Port, Resource Limits (CPU/Memory).
  - Support edges: Source, Target, Protocol (`HTTP`, `gRPC`), Dependency Type (`Sync`, `Async`).
  - Validation catches circular synchronous dependencies and invalid port bindings.

### US-005: Sandbox Provisioning
- **As a** Developer,
- **I want to** provision a live sandbox environment from my defined topology with one click,
- **So that** an isolated Kubernetes namespace is created and all services are running and instrumented.
- **Acceptance Criteria:**
  - Kubernetes namespace created with format `sandbox-{tenant_prefix}-{uuid}`.
  - Deployments, Services, Toxiproxy sidecars, `ResourceQuota`, and `NetworkPolicy` created.
  - Status updates stream asynchronously via WebSocket / Polling: `PROVISIONING` $\to$ `READY`.

### US-006: Chaos Experiment Configuration
- **As an** SRE,
- **I want to** configure a controlled chaos experiment against a specific dependency in my sandbox,
- **So that** I can test how my upstream services behave when downstream services degrade.
- **Acceptance Criteria:**
  - Configurable parameters: Fault Type (`latency`, `packet_loss`, `cpu_burn`), Target Service, Duration (30s to 600s), Intensity (e.g., latency ms).
  - Configuration saved and validated against sandbox state.

### US-007: Chaos Experiment Execution
- **As an** SRE,
- **I want to** execute a configured experiment and watch real-time metrics,
- **So that** I can verify whether circuit breakers trip and fallbacks work.
- **Acceptance Criteria:**
  - Asynchronous dispatch to Celery worker.
  - Worker communicates with Toxiproxy sidecar or Kubernetes API to inject fault.
  - Status updates to `RUNNING`, records start timestamp, and begins incident monitoring.

### US-008: Experiment Cancellation (Emergency Stop / Kill Switch)
- **As an** On-Call Engineer,
- **I want to** abort an in-flight chaos experiment immediately,
- **So that** any unexpected severe degradation is stopped without waiting for the timer to expire.
- **Acceptance Criteria:**
  - `POST /experiments/{id}/stop` executes immediately.
  - Worker removes all active toxics via Toxiproxy API within $\le 3$ seconds.
  - Experiment marked as `ABORTED`; cluster verified clean.

### US-009: Observability Monitoring
- **As an** Engineer,
- **I want to** view live charts of P50/P95/P99 latency, request rates, error rates, and CPU/Memory for all sandbox services,
- **So that** I have full visibility into system behavior during steady-state and chaos.
- **Acceptance Criteria:**
  - Dashboard queries Prometheus via backend API.
  - Synchronized timeline highlighting the exact window of chaos injection.

### US-010: Incident Detection
- **As an** SRE,
- **I want to** have incidents automatically detected when latency or error rates exceed SLO thresholds,
- **So that** I do not have to manually stare at graphs to know something broke.
- **Acceptance Criteria:**
  - Continuous evaluation of sliding window metrics (e.g., Error Rate > 5% over 30s).
  - Incident record generated with timestamp, affected service, metric snapshot, and status `DETECTED`.

### US-011: Root Cause Analysis (Deterministic)
- **As an** Incident Commander,
- **I want to** run deterministic root cause analysis on an incident,
- **So that** I can immediately see the true origin of failure rather than upstream symptoms.
- **Acceptance Criteria:**
  - Algorithmic traversal of the topology graph combined with trace span durations and metric anomaly onset times.
  - Outputs ranked candidate root causes with numerical confidence scores ($0.0 - 1.0$).
  - Distinguishes between root causes (e.g., Payment latency) and cascading victims (e.g., Order service thread pool exhaustion).

### US-012: AI-Generated Explanations
- **As an** Incident Responder,
- **I want to** receive an AI-generated explanation grounded strictly in the collected evidence,
- **So that** I get an executive-level summary, failure timeline, and actionable remediation without hallucinated details.
- **Acceptance Criteria:**
  - Structured prompt fed to Groq/LLM containing only verified telemetry and candidate rankings.
  - Output validated against a Pydantic schema.
  - Hallucination checks verify all mentioned services and metrics match the evidence pack.

### US-013: Report Generation
- **As an** Engineering Lead,
- **I want to** generate and download a comprehensive post-mortem report,
- **So that** I can share the incident findings with leadership and file remediation tickets.
- **Acceptance Criteria:**
  - Generates Markdown and clean printable/PDF format.
  - Includes: Metadata, Topology Diagram, Incident Timeline, Telemetry Graphs, RCA Confidence Matrix, and AI Remediation Runbook.

### US-014: Experiment History & Audit Trail
- **As an** Auditor or Architect,
- **I want to** review historical experiment runs, their configurations, observed telemetry, and detected incidents,
- **So that** our team can measure resilience improvement over time.
- **Acceptance Criteria:**
  - Filterable by project, service, date range, and outcome (`SUCCESS`, `DEGRADED`, `FAILED`, `ABORTED`).
  - Immutable audit log records who initiated, modified, or terminated each experiment.
