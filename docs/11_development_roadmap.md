# Platform Development Roadmap (Milestones M0 through M12)

## 1. Overview and Incremental Strategy

The platform development is structured into 13 rigorous, testable milestones designed to take the project from foundational architecture to a production-grade distributed systems platform.

Every milestone builds incrementally on previous deliverables. Application code is strictly prohibited from bypassing previous milestone acceptance criteria.

---

## 2. Detailed Milestone Specifications

### Milestone M0: Product & Architecture Foundation (Current Milestone)
- **Objectives:** Establish the complete product requirements, high-level and low-level system designs, database schemas, API contracts, security models, reliability plans, and ADRs.
- **Implementation Tasks:**
  1. Author problem statement, user personas, and PRD (`docs/01_problem_statement.md`, `docs/02_product_requirements.md`).
  2. Create high-level system architecture and Mermaid diagrams (`docs/03_system_architecture.md`).
  3. Detail component low-level designs and interview deep-dives (`docs/04_component_design.md`).
  4. Design complete PostgreSQL schema and ER diagrams (`docs/05_database_design.md`).
  5. Define OpenAPI-aligned REST API contracts (`docs/06_api_specification.md`).
  6. Document technology decision trade-offs and author ADR-001 through ADR-010 (`docs/07_technology_decisions.md`, `docs/architecture/adr/`).
  7. Formulate security, reliability, and frontend specifications (`docs/08_security_architecture.md`, `docs/09_reliability_design.md`, `docs/10_frontend_design_specification.md`).
- **Required Files:** All markdown files under `docs/`.
- **Dependencies:** None.
- **Acceptance Criteria:** Comprehensive documentation completed with zero unresolved architecture conflicts.
- **Engineering Concepts to Understand:** Domain-Driven Design (DDD), Separation of Concerns, Multi-Tenant Partitioning, Defense-in-Depth, Trade-Off Analysis.

---

### Milestone M1: Backend & Infrastructure Foundation
- **Objectives:** Scaffold the Python 3.12+ backend repository, configure Docker Compose for local dependencies, establish database connection pooling, and set up Alembic migrations.
- **Implementation Tasks:**
  1. Initialize Python environment with `pyproject.toml`, Poetry/Pipenv, Ruff, and Mypy.
  2. Create `docker-compose.yml` defining PostgreSQL 16 and Redis 7.
  3. Implement `src/core/config.py` (Pydantic BaseSettings) and `src/core/database.py` (SQLAlchemy 2.x async engine).
  4. Initialize Alembic and create the initial migration scaffold.
  5. Configure structured logging with correlation IDs and JSON formatting.
- **Required Files:** `pyproject.toml`, `docker-compose.yml`, `src/core/*`, `alembic/*`.
- **Dependencies:** M0.
- **Acceptance Criteria:** `docker compose up` starts PostgreSQL and Redis; FastAPI starts and passes `/healthz` check querying database connectivity.
- **Tests:** Pytest integration tests verifying database connection and Alembic migration upgrade/downgrade cycles.
- **Engineering Concepts:** Asynchronous I/O (`asyncio`, `uvloop`), Connection Pooling, Database Migrations, Settings Management.

---

### Milestone M2: Authentication & Multi-Tenancy
- **Objectives:** Implement user registration, Argon2id password hashing, JWT token lifecycle, tenant creation, and RBAC middleware.
- **Implementation Tasks:**
  1. Implement User, Tenant, and TenantMembership SQLAlchemy models and Alembic migration.
  2. Implement `src/domains/auth/` (Argon2id hashing, JWT generation, refresh token management in Redis).
  3. Create REST endpoints: `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/refresh`.
  4. Implement FastAPI dependency injection for `get_current_user` and `get_current_tenant`.
  5. Implement RBAC permission verification decorator.
- **Required Files:** `src/domains/auth/*`, `src/api/v1/auth.py`, `src/api/dependencies.py`.
- **Dependencies:** M1.
- **Acceptance Criteria:** Complete auth lifecycle working; cross-tenant data access blocked with 403 Forbidden.
- **Tests:** Unit tests for password hashing; API tests for registration, login, token refresh, and tenant isolation enforcement.
- **Engineering Concepts:** Cryptographic Password Hashing (Argon2id), JWT Claims & Signature Verification, OAuth2 Bearer Flow, Scoped Dependency Injection.

---

### Milestone M3: Kubernetes Sandbox Manager
- **Objectives:** Automate the dynamic provisioning and tearing down of isolated Kubernetes namespaces with ResourceQuota, LimitRange, and NetworkPolicy.
- **Implementation Tasks:**
  1. Configure local Kind cluster script (`scripts/setup-kind.sh`).
  2. Implement `K8sClientWrapper` using `kubernetes_asyncio`.
  3. Implement `K8sManifestBuilder` generating Namespace, Quota, Limits, and NetworkPolicy YAML/JSON specs.
  4. Implement Celery async tasks for sandbox provisioning and background teardown.
  5. Implement sandbox CRUD REST endpoints (`/api/v1/sandboxes`).
- **Required Files:** `src/domains/sandbox/*`, `src/workers/sandbox_tasks.py`, `src/api/v1/sandboxes.py`.
- **Dependencies:** M2.
- **Acceptance Criteria:** Triggering `POST /api/v1/sandboxes` provisions an isolated namespace in Kind within $< 45\text{ seconds}$ verified via `kubectl get ns`.
- **Tests:** Integration tests using a live Kind cluster validating namespace creation, quota enforcement, and NetworkPolicy rules.
- **Engineering Concepts:** Kubernetes API Client, Namespace Lifecycle, ResourceQuotas, NetworkPolicy CNI enforcement, Background Worker Orchestration.

---

### Milestone M4: Microservice Topology & Deployments
- **Objectives:** Support declarative service topology definitions and deploy the 6-tier e-commerce microservices with injected Toxiproxy sidecars.
- **Implementation Tasks:**
  1. Implement Project, Topology, Service, and Dependency database models.
  2. Implement DAG validation to detect cyclical synchronous dependencies.
  3. Containerize sample e-commerce microservices (Order, Payment, Inventory, etc.) with OpenTelemetry SDK.
  4. Implement deployment manifest compiler injecting the microservice container alongside the Toxiproxy sidecar container.
  5. Implement endpoints: `/api/v1/topologies`, `/api/v1/projects`.
- **Required Files:** `src/domains/topology/*`, `samples/ecommerce/*`, `src/api/v1/topologies.py`.
- **Dependencies:** M3.
- **Acceptance Criteria:** Topology deploys all 6 microservices into the sandbox namespace; all pods report `2/2 Ready` (app + sidecar).
- **Tests:** DAG cycle detection unit tests; Kubernetes deployment verification tests.
- **Engineering Concepts:** Directed Acyclic Graphs (DAGs), Sidecar Container Pattern, Pod Specification Hardening, Microservice Configuration via Env Vars.

---

### Milestone M5: Chaos Experiment Engine
- **Objectives:** Implement controlled fault injection (network latency, jitter, packet loss) via Toxiproxy and compute stress via ephemeral containers.
- **Implementation Tasks:**
  1. Implement async `ToxiproxyClient` managing toxic CRUD operations over HTTP REST port 8474.
  2. Implement `ExperimentRunner` Celery task managing duration loops, Redis heartbeats, and safe rollback.
  3. Implement Kill Switch endpoint (`POST /api/v1/experiments/{id}/stop`).
  4. Implement Watchdog reconciliation task in Celery Beat to auto-recover orphaned toxics.
- **Required Files:** `src/domains/chaos/*`, `src/workers/chaos_tasks.py`, `src/workers/reconciler_tasks.py`, `src/api/v1/experiments.py`.
- **Dependencies:** M4.
- **Acceptance Criteria:** Running an experiment injects 2000ms latency on Payment Service; synthetic traffic confirms measured latency increases by 2000ms; stop command restores baseline latency in $\le 3\text{ seconds}$.
- **Tests:** Toxiproxy client unit tests; end-to-end chaos execution and kill-switch recovery tests; worker crash simulation test.
- **Engineering Concepts:** Layer-4/7 Proxying, Fault Injection Patterns, Distributed Heartbeats, Watchdog Reconcilers, Graceful Rollback.

---

### Milestone M6: OpenTelemetry & Observability Pipeline
- **Objectives:** Deploy the OpenTelemetry Collector, Prometheus, Jaeger, and Loki, routing telemetry from sandbox pods to storage backends.
- **Implementation Tasks:**
  1. Deploy OpenTelemetry Collector with OTLP receivers and Prometheus/Jaeger/Loki exporters.
  2. Deploy Prometheus server configured to scrape OTel Collector metrics.
  3. Deploy Jaeger all-in-one for distributed trace ingestion and indexing.
  4. Configure microservice Docker images with OTel auto-instrumentation and W3C trace context propagation.
  5. Implement backend telemetry proxy endpoints querying PromQL and Jaeger REST APIs.
- **Required Files:** `deploy/observability/*`, `src/domains/observability/*`.
- **Dependencies:** M5.
- **Acceptance Criteria:** Making HTTP requests to the deployed microservice generates visible trace trees in Jaeger and metrics in Prometheus enriched with `tenant_id` and `sandbox_id`.
- **Tests:** Telemetry continuity tests verifying trace span propagation across all 6 microservices.
- **Engineering Concepts:** Distributed Tracing, W3C Trace Context (`traceparent`), Metrics TSDB, High-Cardinality Telemetry, Collector Processing Pipelines.

---

### Milestone M7: Incident Detection Engine
- **Objectives:** Automate the detection of performance degradation and SLO violations during chaos experiments using sliding-window PromQL queries.
- **Implementation Tasks:**
  1. Implement Incident and IncidentEvidence database models.
  2. Implement background evaluator loop querying Prometheus for P99 latency breaches ($>500\text{ms}$) and 5xx error spikes ($>5\%$).
  3. Implement deduplication logic grouping concurrent alerts within a 60-second window into a single unified `Incident`.
  4. Implement incident triage REST endpoints: `/api/v1/incidents`.
- **Required Files:** `src/domains/incident/*`, `src/workers/telemetry_tasks.py`, `src/api/v1/incidents.py`.
- **Dependencies:** M6.
- **Acceptance Criteria:** Injecting latency during an experiment automatically creates an `Incident` entity in PostgreSQL within 15 seconds of SLO breach.
- **Tests:** Simulated PromQL alerting tests; incident deduplication logic unit tests.
- **Engineering Concepts:** Service Level Objectives (SLOs), Sliding-Window Metric Evaluation, Alert Deduplication, Incident State Machines.

---

### Milestone M8: Deterministic Root Cause Analysis (RCA) Engine
- **Objectives:** Implement the mathematical graph correlation engine that determines root causes by combining temporal precedence, trace span self-time, and topological DAG traversal.
- **Implementation Tasks:**
  1. Implement `TemporalPrecedenceAnalyzer` calculating metric anomaly onset timestamps ($t_{\text{anomaly}}$).
  2. Implement `TraceDecomposer` parsing Jaeger trace trees and computing span self-time vs. child wait-time.
  3. Implement `GraphTraverser` traversing the service dependency DAG.
  4. Implement the scoring equation: $\text{Score} = w_1\mathcal{T} + w_2\mathcal{S} + w_3\mathcal{D} + w_4\mathcal{A}$.
  5. Implement `EvidencePackBuilder` assembling the verifiable analysis JSON payload.
- **Required Files:** `src/domains/rca/*`, `src/api/v1/incidents.py` (analyze endpoint).
- **Dependencies:** M7.
- **Acceptance Criteria:** When Payment Service latency is injected, the engine correctly assigns Payment Service the highest confidence score ($\ge 0.90$) and flags Order Service as a downstream victim symptom ($\le 0.50$).
- **Tests:** Unit and fixture replay tests evaluating the scoring formula across various simulated failure scenarios (cascading timeout, database crash, thread pool exhaustion).
- **Engineering Concepts:** Graph Theory & Topological Sorting, Span Duration Attribution, Anomaly Detection Z-Scores, Deterministic Causal Inference.

---

### Milestone M9: AI Explanation Engine & Report Generation
- **Objectives:** Ground LLM inference (via Groq API) on the deterministic Evidence Pack, enforce Pydantic output schemas, validate against hallucinations, and generate downloadable post-mortem reports.
- **Implementation Tasks:**
  1. Implement `ILLMProvider` interface and `GroqLLMProvider` using official Groq Python SDK.
  2. Implement strict Pydantic prompt templates and validation models.
  3. Implement Hallucination Verification filter checking entity names and metrics against the Evidence Pack.
  4. Implement `ReportService` generating Markdown and PDF incident reports.
  5. Implement `/api/v1/incidents/{id}/report` export endpoints.
- **Required Files:** `src/domains/ai_explanation/*`, `src/domains/report/*`.
- **Dependencies:** M8.
- **Acceptance Criteria:** API returns validated JSON containing executive summary, timeline, and mitigation runbook; $100\%$ of cited entities match the evidence pack; PDF report generates cleanly.
- **Tests:** Mocked LLM provider tests; Pydantic schema validation tests; hallucination rejection tests.
- **Engineering Concepts:** Grounded LLM Prompting, Structured JSON Output Enforcement, Hallucination Prevention, PDF Rendering Engines.

---

### Milestone M10: Frontend Implementation & Integration
- **Objectives:** Build the complete Next.js frontend application matching Google Stitch designs and consuming the backend REST API contracts.
- **Implementation Tasks:**
  1. Scaffold Next.js 14 App Router project with Tailwind CSS and shadcn/ui.
  2. Implement Auth pages with JWT token refresh interceptors.
  3. Implement React Flow interactive Service Topology Builder.
  4. Implement Live Experiment Execution screen with real-time Recharts telemetry streams.
  5. Implement Incident Investigation view with trace span waterfalls and RCA post-mortem downloader.
- **Required Files:** `frontend/*` (Next.js components, hooks, api clients).
- **Dependencies:** M9.
- **Acceptance Criteria:** User can visually design a topology, provision a sandbox, launch a chaos experiment, watch live charts, and view the AI post-mortem report from the browser.
- **Tests:** Playwright end-to-end tests covering user registration, topology creation, and experiment execution.
- **Engineering Concepts:** Server-Side Rendering (SSR), Client State Management (React Query), Interactive Canvas Graphs (React Flow), Synchronized Time-Series Charting.

---

### Milestone M11: Testing, Benchmarking & Security Hardening
- **Objectives:** Execute end-to-end resilience tests, benchmark API and worker performance, and verify multi-tenant security boundaries.
- **Implementation Tasks:**
  1. Author Locust synthetic load test scripts simulating 100 concurrent users.
  2. Execute automated security scan: verify cross-tenant data leakage is prevented across all endpoints.
  3. Execute NetworkPolicy penetration test: verify pods in `sandbox-A` cannot ping or reach pods in `sandbox-B`.
  4. Measure and document actual latencies against proposed NFR targets.
- **Required Files:** `tests/load/*`, `tests/security/*`.
- **Dependencies:** M10.
- **Acceptance Criteria:** Zero cross-tenant data leaks; API P95 latency $< 100\text{ms}$; Kill switch reliably terminates faults within 3 seconds.
- **Tests:** End-to-end security test suite, chaos recovery resilience tests, Locust load benchmarks.
- **Engineering Concepts:** Load Testing & Stress Testing, Multi-Tenant Penetration Testing, Performance Profiling, Memory Leak Detection.

---

### Milestone M12: Production Deployment & Final Documentation
- **Objectives:** Create production Helm charts, Dockerfiles, CI/CD GitHub Actions pipelines, and complete user/developer documentation.
- **Implementation Tasks:**
  1. Package backend and frontend into multi-stage production Docker images.
  2. Author production Helm charts for Kubernetes deployment (EKS/GKE).
  3. Implement GitHub Actions workflow running linting, type checks, unit tests, and Kind integration tests on every PR.
  4. Write comprehensive Developer Guide and API documentation.
- **Required Files:** `Dockerfile`, `helm/*`, `.github/workflows/*`, `README.md`.
- **Dependencies:** M11.
- **Acceptance Criteria:** Full automated CI/CD pipeline green; single-command deployment via Helm onto a clean Kubernetes cluster.
- **Engineering Concepts:** Multi-Stage Container Builds, Helm Chart Architecture, CI/CD Pipeline Optimization, Infrastructure as Code (IaC).
