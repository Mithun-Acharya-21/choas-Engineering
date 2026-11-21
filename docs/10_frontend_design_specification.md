# Frontend Design Specification (Google Stitch & Vercel v0 Blueprint)

## 1. Design System & Global Principles

This document serves as the authoritative specification for frontend generation using **Google Stitch** (UI/UX design) and **Vercel v0** (component generation).

### 1.1 Aesthetic & Visual Identity
- **Design Philosophy:** Dark-mode-first, high-density, engineering-grade observability aesthetic inspired by modern infrastructure tools (Datadog, Grafana, Linear, Vercel).
- **Color Palette:**
  - Background (Canvas): `zinc-950` (`#09090b`)
  - Surface / Card Background: `zinc-900` (`#18181b`)
  - Border / Separators: `zinc-800` (`#27272a`)
  - Muted Text: `zinc-400` (`#a1a1aa`)
  - Primary Accent: `emerald-500` (`#10b981`) for steady state / healthy indicators.
  - Chaos / Active Fault Accent: `amber-500` (`#f59e0b`).
  - Critical / Incident Accent: `rose-500` (`#f43f5e`).
  - Interactive Brand / Action: `indigo-500` (`#6366f1`).
- **Typography:**
  - Sans-Serif: `Inter` (UI elements, headers, body).
  - Monospace: `JetBrains Mono` or `Fira Code` (JSON payloads, trace IDs, PromQL, metrics, timestamps, container names).
- **Component Primitives:** **shadcn/ui** built on Radix UI primitives with Tailwind CSS.
- **Graph & Visualization Libraries:**
  - Microservice Topologies: **React Flow** (custom dark-mode SVG nodes and animated bezier edges).
  - Telemetry & Metrics: **Recharts** (responsive time-series area and line charts with synchronized crosshair tooltips).

---

## 2. Global Navigation & Layout Architecture

The application adopts a persistent collateral navigation layout:
- **Left Collapsible Sidebar (Width: 240px / 64px collapsed):**
  - Tenant Switcher (Dropdown with active tenant slug).
  - Project Selector.
  - Primary Navigation Links:
    - 📊 Dashboard (`/dashboard`)
    - 🕸️ Topology Builder (`/projects/:id/topology`)
    - 🧪 Sandboxes (`/sandboxes`)
    - ⚡ Chaos Experiments (`/experiments`)
    - 📈 Observability & Metrics (`/observability`)
    - 🚨 Incident Management (`/incidents`)
    - 📜 Audit Trail & History (`/history`)
    - ⚙️ Settings (`/settings`)
- **Top Utility Bar:**
  - Active Sandbox status badge (`SANDBOX: READY` / `PROVISIONING`).
  - Global Kill Switch button (Red outline with confirmation dialog).
  - User profile menu & logout.

---

## 3. Screen Specifications (13 Core Screens)

### Screen 1: Login & Registration (`/auth/login`, `/auth/register`)
- **Purpose:** Secure user onboarding and session establishment.
- **Layout:** Centered card with clean background subtle radial gradient.
- **Components:**
  - Form tabs: "Sign In" / "Create Account".
  - Input fields: Email, Password, Full Name, Organization Name.
  - Submit button with spinner loading state.
- **API Endpoints:**
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/register`
- **States:**
  - Loading: Button disabled with spinner: *"Authenticating..."*.
  - Error: Inline callout (`rose-500`): *"Invalid email or password"*.

---

### Screen 2: Main Dashboard (`/dashboard`)
- **Purpose:** At-a-glance executive view of active sandboxes, in-flight experiments, recent incidents, and system health.
- **Layout:** 4-column metric cards row, followed by a 2-column split (Left: Active Experiments & Topology preview; Right: Recent Incidents stream).
- **Components:**
  - KPI Cards: "Active Sandboxes", "Experiments Run Today", "Open Incidents", "MTTR (Mean Time to Resolution)".
  - Active Experiment Banner (flashes amber when chaos is active).
  - Quick Action Buttons: "New Sandbox", "Run Experiment".
- **API Endpoints:**
  - `GET /api/v1/projects`
  - `GET /api/v1/sandboxes`
  - `GET /api/v1/incidents?status=DETECTED`

---

### Screen 3: Tenant & Project Management (`/projects`)
- **Purpose:** Manage project boundaries, view member lists, and configure tenant settings.
- **Layout:** Header with "Create Project" modal trigger, grid of project cards.
- **Components:**
  - Project Cards displaying name, description, sandbox count, and last experiment date.
  - "New Project" modal with name, slug, and description inputs.
- **API Endpoints:**
  - `GET /api/v1/projects`
  - `POST /api/v1/projects`
- **Permissions:** `TenantOwner` and `Engineer` can create projects; `Viewer` has read-only access.

---

### Screen 4: Service Topology Builder (`/projects/:id/topology`)
- **Purpose:** Interactive visual canvas to drag, drop, connect, and configure microservice nodes and dependencies.
- **Layout:** Full-screen canvas with left node palette and right configuration drawer.
- **Components:**
  - **React Flow Canvas:** Custom nodes for microservices with health indicator lights, port badges, and directional arrows indicating call flow (`HTTP`/`gRPC`, `Sync`/`Async`).
  - Node Inspector Drawer: Configure Service Name, Container Image, Ports, Environment Variables, and CPU/Memory limits.
  - "Save Topology" button (with dirty-state indicator).
  - "Deploy as Sandbox" trigger button.
- **API Endpoints:**
  - `GET /api/v1/topologies/{id}`
  - `PUT /api/v1/topologies/{id}`
  - `POST /api/v1/sandboxes` (Direct deployment)
- **States:**
  - Empty: "Add your first microservice to begin designing your topology."

---

### Screen 5: Sandbox Management (`/sandboxes`)
- **Purpose:** Inspect running Kubernetes sandboxes, pod health, resource quotas, and trigger cleanups.
- **Layout:** Table view of all sandboxes for the active project with expandable pod detail rows.
- **Components:**
  - Sandbox status pills: `PROVISIONING` (blue spinner), `READY` (emerald), `FAILED` (rose), `TERMINATING` (amber).
  - Pod Inspection Table: Pod Name, Ready Status (`2/2`), Restart Count, Toxiproxy Status (`ACTIVE`).
  - Action Dropdown: "View Telemetry", "Run Chaos", "Delete Sandbox".
- **API Endpoints:**
  - `GET /api/v1/sandboxes`
  - `GET /api/v1/sandboxes/{id}`
  - `DELETE /api/v1/sandboxes/{id}`

---

### Screen 6: Chaos Experiment Center (`/experiments`)
- **Purpose:** Catalog of reusable chaos experiment templates and configuration wizard.
- **Layout:** 3-column card grid categorized by fault type (Network Latency, Packet Loss, CPU Burn, Pod Kill).
- **Components:**
  - Experiment Card with badge: `FAULT: LATENCY`, Target: `payment-service`, Duration: `60s`.
  - "New Experiment" Wizard: Step 1: Select Target Service; Step 2: Choose Fault Type & Intensity; Step 3: Duration & Safety Guardrails.
  - Quick "Run Now" button on cards.
- **API Endpoints:**
  - `GET /api/v1/experiments`
  - `POST /api/v1/experiments`
  - `POST /api/v1/experiments/{id}/run`

---

### Screen 7: Live Experiment Execution Details (`/experiments/runs/:id`)
- **Purpose:** Real-time mission control during an active chaos experiment.
- **Layout:** Two-tier: Top tier shows Experiment Status, Elapsed Time progress bar, and large RED "STOP EXPERIMENT" button. Bottom tier shows side-by-side live metrics and active event logs.
- **Components:**
  - Live Countdown Timer: `00:45 / 01:00` with animated progress line.
  - Real-time Recharts stream: Ingress latency of target service (P50, P95, P99) with shaded chaos window.
  - Terminal Event Log: Streaming worker events (`[Toxiproxy] Injected 2000ms latency...`, `[Detection] P99 threshold breached...`).
  - Emergency Kill Switch Button.
- **API Endpoints:**
  - `GET /api/v1/experiments/{id}/runs/{run_id}`
  - `POST /api/v1/experiments/{id}/stop`

---

### Screen 8: Observability Dashboard (`/observability`)
- **Purpose:** Deep telemetry inspection for a selected sandbox across metrics and distributed traces.
- **Layout:** Filter bar (Sandbox selector, Time Window: Last 5m, 15m, 1h) followed by a 4-chart grid.
- **Components:**
  - Chart 1: Request Rate (RPS by service).
  - Chart 2: P99 Latency (ms by service).
  - Chart 3: Error Rate (5xx % by service).
  - Chart 4: CPU & Memory Consumption.
  - Synchronized tooltips: Hovering over one chart draws vertical crosshair lines across all four.
- **API Endpoints:**
  - Communicates with backend telemetry endpoints wrapping Prometheus and Jaeger.

---

### Screen 9: Incident Management (`/incidents`)
- **Purpose:** Triage, filter, and inspect incidents detected during experiments.
- **Layout:** Filterable table with severity badges (`CRITICAL`, `WARNING`).
- **Components:**
  - Columns: Incident Title, Affected Sandbox, Triggering Run, Severity, Detected At, Status, Action.
  - "Analyze Root Cause" button (triggers deterministic RCA + AI workflow).
- **API Endpoints:**
  - `GET /api/v1/incidents`
  - `GET /api/v1/incidents/{id}`
  - `POST /api/v1/incidents/{id}/analyze`

---

### Screen 10: Incident Root Cause Analysis View (`/incidents/:id/rca`)
- **Purpose:** Interactive investigation view displaying deterministic rankings and causal propagation graphs.
- **Layout:** Left panel: Candidate Ranking Matrix & Causal Path; Right panel: Distributed Trace Span Waterfall and Anomaly Timelines.
- **Components:**
  - **Candidate Confidence Table:**
    - Service Name, Confidence Score (`94%`), Classification (`ROOT_CAUSE` vs `SYMPTOM`), Trace Self-Time (`97%`).
  - **Causal Graph Visualizer:** Highlights failure propagation path (`payment-service` $\to$ `order-service` $\to$ `api-gateway`).
  - **Trace Waterfall:** Interactive flame graph showing parent span `POST /orders` waiting 2.1s for child span `POST /charge`.
  - "Generate AI Post-Mortem" button.
- **API Endpoints:**
  - `POST /api/v1/incidents/{id}/analyze`

---

### Screen 11: RCA Post-Mortem Report (`/incidents/:id/report`)
- **Purpose:** Formal, printable, and downloadable incident post-mortem.
- **Layout:** Document layout with clean typography, styled headers, and embedded charts.
- **Components:**
  - Header: Incident Metadata, Timestamp, Duration, Severity, Participants.
  - Executive Summary (AI-generated, grounded in evidence).
  - Failure Timeline (Chronological events with exact timestamps).
  - Root Cause Analysis Breakdown (Deterministic scores and justification).
  - Remediation Runbook (Checklist of actionable engineering fixes: timeout tuning, circuit breaker configs).
  - Download Buttons: "Download PDF", "Export Markdown", "Copy JSON".
- **API Endpoints:**
  - `GET /api/v1/incidents/{id}/report?format=pdf`
  - `GET /api/v1/incidents/{id}/report?format=markdown`

---

### Screen 12: Experiment History & Audit Trail (`/history`)
- **Purpose:** Historical record of all executed experiments, outcomes, and audit logs.
- **Layout:** Full-width filterable data table with date range picker.
- **Components:**
  - Columns: Timestamp, User, Action (`RUN_EXPERIMENT`), Target Service, Outcome (`COMPLETED`, `ABORTED`, `FAILED`), Duration.
  - Filter by Outcome, User, or Service.
- **API Endpoints:**
  - `GET /api/v1/experiments/{id}` (historical runs)
  - Backend audit log endpoints.

---

### Screen 13: Settings & User Management (`/settings`)
- **Purpose:** Manage organization members, API tokens, and platform preferences.
- **Layout:** Vertical tabs (General, Team Members, API Keys, Danger Zone).
- **Components:**
  - Team Member list with role dropdown (`Viewer`, `Engineer`, `TenantOwner`).
  - "Invite Member" dialog.
  - Personal API Token generator for CI/CD integration.
  - Danger Zone: "Delete Tenant" (Requires password re-confirmation).
- **API Endpoints:**
  - `GET /api/v1/tenants/{id}`
  - `POST /api/v1/auth/invite`
