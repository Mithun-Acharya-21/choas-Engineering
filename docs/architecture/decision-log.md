# Architecture Decision Log

This log tracks all architectural decisions for the **AI Root Cause Analysis & Chaos Engineering Platform**. Every significant decision is captured in a formal Architecture Decision Record (ADR) under `docs/architecture/adr/`.

| ADR ID | Title | Date | Status | Decision Summary |
| :--- | :--- | :--- | :--- | :--- |
| [ADR-001](adr/ADR-001.md) | Backend Framework Selection | 2026-11-18 | **Accepted** | Use FastAPI (Python 3.12+) with Pydantic v2 for async REST APIs, automatic OpenAPI specs, and native AI/data science library integration. |
| [ADR-002](adr/ADR-002.md) | Database Selection | 2026-11-18 | **Accepted** | Use PostgreSQL 16 with `asyncpg` and SQLAlchemy 2.x for ACID metadata, relational graph integrity, and JSONB schema flexibility. |
| [ADR-003](adr/ADR-003.md) | Background Job Architecture | 2026-11-18 | **Accepted** | Use Celery with Redis for asynchronous long-running sandbox provisioning, chaos experiment loops, and watchdog reconciliation. |
| [ADR-004](adr/ADR-004.md) | Kubernetes Isolation Strategy | 2026-11-18 | **Accepted** | Enforce multi-tenant sandbox isolation via dynamic Kubernetes Namespaces, default-deny NetworkPolicies, and ResourceQuotas. |
| [ADR-005](adr/ADR-005.md) | Observability Architecture | 2026-11-18 | **Accepted** | Deploy OpenTelemetry Collector to ingest telemetry from sandbox pods and forward metrics to Prometheus, traces to Jaeger, and logs to Loki. |
| [ADR-006](adr/ADR-006.md) | Chaos Experiment Execution | 2026-11-18 | **Accepted** | Use Toxiproxy sidecars for layer-4/7 network fault injection and container cgroup stress injectors, avoiding privileged cluster-wide daemons. |
| [ADR-007](adr/ADR-007.md) | Root Cause Analysis (RCA) Architecture | 2026-11-18 | **Accepted** | Implement a deterministic mathematical engine combining topological DAG traversal, temporal precedence, and trace span self-time decomposition. |
| [ADR-008](adr/ADR-008.md) | AI Provider Abstraction | 2026-11-18 | **Accepted** | Abstract LLM inference behind a provider interface with Groq as default, enforcing strict Pydantic JSON schemas and hallucination validation. |
| [ADR-009](adr/ADR-009.md) | Frontend Architecture | 2026-11-18 | **Accepted** | Build with Next.js (App Router), React Flow, Recharts, and shadcn/ui to match Google Stitch design specs and Vercel v0 implementation patterns. |
| [ADR-010](adr/ADR-010.md) | Security and Tenant Isolation | 2026-11-18 | **Accepted** | Enforce multi-tenancy at database query layer, JWT RBAC at API layer, and Pod Security Standards with default-deny networking at cluster layer. |
