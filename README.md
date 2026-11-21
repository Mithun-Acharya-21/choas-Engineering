# AI Root Cause Analysis & Chaos Engineering Platform

An enterprise-grade, multi-tenant Chaos Engineering and AI-powered Root Cause Analysis platform designed for distributed microservice architectures on Kubernetes.

---

## Architecture & System Design Documentation Suite

The complete engineering specification produced for **Milestone 1** is organized as follows:

| Document | Description |
| :--- | :--- |
| **[01. Problem Statement](docs/01_problem_statement.md)** | Problem statement, product vision, target personas, user journeys, and reference e-commerce scenario. |
| **[02. Product Requirements Document](docs/02_product_requirements.md)** | Functional (FR-001–FR-032) and Non-Functional (NFR-001–NFR-010) requirements, constraints, and 14 detailed user stories. |
| **[03. High-Level System Architecture](docs/03_system_architecture.md)** | Detailed architecture of Components A through M, 7 comprehensive Mermaid architecture and sequence diagrams. |
| **[04. Component Low-Level Design](docs/04_component_design.md)** | Subsystem designs (Sandbox Manager, Chaos Engine, Observability, Incident Engine, Deterministic RCA, AI Engine) and system design interview deep-dives. |
| **[05. Database Architecture](docs/05_database_design.md)** | Complete PostgreSQL 16 schema (14 tables), Mermaid ER diagram, indexing, JSONB usage justification, and retention strategies. |
| **[06. REST API Specification](docs/06_api_specification.md)** | OpenAPI 3.1-aligned REST API contracts with request/response schemas and status codes for Google Stitch and Vercel v0. |
| **[07. Technology Decision Analysis](docs/07_technology_decisions.md)** | Rigorous trade-off analysis comparing every selected technology with industry alternatives. |
| **[Architecture Decision Log](docs/architecture/decision-log.md)** | Index of Architecture Decision Records (ADRs). |
| **[ADRs (ADR-001 to ADR-010)](docs/architecture/adr/)** | 10 individual Architecture Decision Records covering framework, database, workers, isolation, observability, chaos, RCA, AI, frontend, and security. |
| **[08. Security Architecture](docs/08_security_architecture.md)** | Multi-tenant defense-in-depth, JWT lifecycle, RBAC matrix, Pod Security Standards, NetworkPolicies, and Global Kill Switch. |
| **[09. Failure & Reliability Design](docs/09_reliability_design.md)** | 12 detailed failure scenario matrices and autonomous watchdog reconciliation loops. |
| **[10. Frontend Design Specification](docs/10_frontend_design_specification.md)** | UI/UX blueprint for Google Stitch and Vercel v0 covering 13 core screens, dark-mode styling, and React Flow / Recharts integrations. |
| **[11. Development Roadmap](docs/11_development_roadmap.md)** | 13-stage incremental engineering roadmap (M0 through M12) with acceptance criteria, deliverables, and educational concepts. |

---

## Baseline Technology Stack

- **Backend:** Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2.x, Alembic, PostgreSQL 16 (`asyncpg`)
- **Background Tasks & Caching:** Redis 7, Celery, Celery Beat
- **Chaos Engineering:** Toxiproxy (sidecar TCP proxy), Kubernetes cgroup stress injectors
- **Observability:** OpenTelemetry Collector, Prometheus (TSDB), Jaeger (Distributed Traces), Loki (Logs)
- **AI Infrastructure:** Groq API (Llama-3-70B structured JSON output), Pydantic validation, Deterministic RCA Engine
- **Frontend:** Next.js 14+ (App Router), React, TypeScript, Tailwind CSS, shadcn/ui, React Flow, Recharts
- **Infrastructure & Testing:** Docker, Docker Compose, Kubernetes (Kind for local development), Testcontainers, Locust, GitHub Actions
