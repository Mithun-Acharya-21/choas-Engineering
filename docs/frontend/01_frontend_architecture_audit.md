# Obsidian Telemetry Frontend Architecture Audit & Safety Hardening Report

## Executive Summary

This audit evaluates the imported **Obsidian Telemetry** (React 19, TypeScript, Tailwind CSS v4, Vite) frontend codebase and outlines the architectural transformations executed to transition it into the production-ready frontend foundation for **ChaosEngine AI**.

---

## 1. Existing Reusable Components

The existing UI primitives exhibit a high-density, dark-mode-first aesthetic with micro-visualizations well-suited for observability and chaos engineering.

| Component | Path | Visual & Functional Role | Reusability Assessment |
| :--- | :--- | :--- | :--- |
| **`StatusBadge`** | `src/components/StatusBadge.tsx` | Visual status pill supporting 9 variants (`healthy`, `injecting`, `critical`, `running`, `completed`, `halted`, `INFO`, `WARN`, `CRIT`) with animated ping indicators. | **Fully Reusable:** Retained as primary badge primitive across all screens. |
| **`Sparkline`** | `src/components/Sparkline.tsx` | 10-point SVG sparkline trend indicator with color thresholds based on latency/error trends. | **Fully Reusable:** High density; used in telemetry tables and cards. |
| **`TimeSeriesChart`** | `src/components/TimeSeriesChart.tsx` | Multi-series SVG time-series visualizer with interactive crosshair tooltips, toggleable series (P99, P95, P50, Baseline), and shaded fault injection windows (`faultActive`). | **Fully Reusable:** Zero external heavy charting dependencies; exceptional rendering performance. |
| **`Sidebar`** | `src/components/Sidebar.tsx` | Collapsible navigation rail with brand lockup, cluster context selector, keyboard shortcut indicators, active fault counters, and mobile off-canvas drawer. | **Hardened & Reusable:** Hardened to enforce sandbox cluster selection only. |
| **`TopBar`** | `src/components/TopBar.tsx` | Utility header displaying monospace breadcrumbs, time-range segmented controls (15m, 1h, 6h, 24h), ⌘K command trigger, and emergency kill switch. | **Hardened & Reusable:** Hardened to target sandbox faults and display simulated data indicators. |
| **`ServiceInspectorDrawer`** | `src/components/ServiceInspectorDrawer.tsx` | Slide-over drawer providing service percentiles, CIDR blocks, workload ready ratios, active faults, and quick actions. | **Hardened & Reusable:** Added sandbox isolation checks and confirmation modal for quick injection. |
| **`CommandPalette`** | `src/components/CommandPalette.tsx` | Modal dialog triggered via `Cmd+K` / `Ctrl+K` for global fuzzy search, screen navigation, and kill switch activation. | **Fully Reusable:** Retained and integrated with React Router. |
| **`ConfirmationModal`** *(New)* | `src/components/ConfirmationModal.tsx` | High-visibility confirmation dialog for destructive actions, high blast radius faults, and kill switch triggers. | **Newly Added:** Enforces Phase 2 safety requirements. |
| **`LoadingState` / `ErrorState` / `EmptyState`** *(New)* | `src/components/*` | Standardized asynchronous states for loading, network errors, and empty data sets. | **Newly Added:** Provides consistent user feedback. |

---

## 2. Existing Screens & Their Interactions

The prototype contained 4 primary screens orchestrated via in-memory tab state in `App.tsx`:

1. **`TelemetryOverviewScreen` (`/` or `/telemetry`):**
   - **Interactions:** Top-level metrics overview (P99 latency, RPS, Error Rate, SLO remaining). Interactive time-series chart with hover crosshairs. List of active chaos experiments with countdowns. Sortable and filterable service mesh table.
   - **Inter-screen Navigation:** Clicking any service opens the `ServiceInspectorDrawer`. Clicking active faults navigates directly to Chaos Lab.
2. **`ChaosLabScreen` (`/chaos`):**
   - **Interactions:** Fault injection workbench allowing selection of target service, fault vector (`latency`, `packet_loss`, `cpu_pressure`, `pod_kill`, `dns_blackhole`), intensity sliders, blast radius slider, and duration presets.
   - **Active Experiments Table:** Real-time countdown progress bars and individual halt buttons with a 2-step confirmation timer.
3. **`TopologyScreen` (`/topology`):**
   - **Interactions:** Interactive 2D node-edge canvas with zoom controls (70% to 130%) and tier filters (`ingress`, `compute`, `data`).
   - **Node Inspector:** Clicking a node highlights upstream callers and downstream dependencies in the right sidebar with quick action buttons.
4. **`LogsTracesScreen` (`/logs`):**
   - **Interactions:** Live console stream filterable by KQL chips (`service:`, `level:`, `trace:`). Clicking a log entry opens the Trace Span waterfall inspector showing span start offsets, durations, and HTTP/gRPC metadata tags.

---

## 3. Mock Data Dependencies & Coupling Analysis

Prior to this refactoring, the application was tightly coupled to hardcoded mock data:
- **`src/data/mockTelemetry.ts`:**
  - Exported static arrays: `CLUSTERS` (with production labels), `INITIAL_SERVICES` (8 services), and `INITIAL_EXPERIMENTS` (4 running experiments).
  - Contained procedural generators: `generateInitialTelemetrySeries` and `buildTraceSpans`.
- **`App.tsx` In-Memory Simulation Loop:**
  - A 2-second `setInterval` directly mutated React `useState` hooks, synthesizing fake P99 spikes, recalculating service percentiles, and appending mock logs.
  - Zero abstraction existed between UI presentation and the simulated backend.

---

## 4. Identified Safety & Architectural Risks

### Risk 1: Dangerous Production Labelling in Chaos Workbench
- **Finding:** The default cluster was `prod-us-east-1`, and sample experiments targeted production PCI settlement namespaces (`settlement-pci`, `commerce-mesh`).
- **Remediation:** All clusters were replaced with isolated sandbox clusters (`sandbox-alpha-us-east-1`, `sandbox-beta-eu-central-1`, `sandbox-dev-local-kind`). All namespaces were renamed to `sandbox-*`.
- **Validation Guardrail:** Created `safetyGuardrails.ts` which blocks any namespace that does not start with `sandbox-`.

### Risk 2: Unprotected Control Plane Workloads
- **Finding:** An operator could target core infrastructure components (API Gateway, PostgreSQL) without restriction.
- **Remediation:** Added `isControlPlaneTarget` check in `safetyGuardrails.ts`. Workloads labeled as control plane or residing in control-plane namespaces cannot be selected for fault injection.

### Risk 3: Unconfirmed Destructive Actions
- **Finding:** Quick latency injection (+200ms) fired immediately on click with zero confirmation.
- **Remediation:** Added `ConfirmationModal` requiring explicit user approval before dispatching faults with high blast radius ($\ge 50\%$) or destructive actions.

### Risk 4: Unbounded Emergency Kill Switch
- **Finding:** The kill switch was globally labelled without scoping to sandbox boundaries.
- **Remediation:** Scoped kill switch explicitly to the active sandbox cluster (`sandbox_halt_all`), ensuring it purges active Toxiproxy sidecar toxics within the active sandbox namespace.

### Risk 5: Misleading Telemetry Representation
- **Finding:** Simulated data looked identical to live production streams, risking operator confusion.
- **Remediation:** Added prominent `[SIMULATED SAMPLE DATA]` and `[SANDBOX ISOLATED]` badges across TopBar and all screens.

---

## 5. Missing Frontend Features (Gap Analysis Against Milestone 1)

While the four existing screens provide an exceptional baseline for telemetry and chaos injection, the following modules are required to complete the production platform:

1. **Multi-Tenant & Project Switcher:** Dedicated selector for switching between organizational tenants and projects.
2. **Dynamic Sandbox Lifecycle Manager:** Screen displaying dynamic Kubernetes namespaces, pod ready status (`2/2`), resource quota consumption, and sandbox expiration timers.
3. **Visual Topology Authoring:** Upgrading the read-only 2D canvas into an editable React Flow canvas where users can drag, connect, and configure microservices.
4. **Automated Incident Triage & Timeline:** Incident list (`/incidents`) capturing automatic PromQL SLO violations with severity badges and evidence packs.
5. **Deterministic RCA Investigation Screen:** Candidate root cause ranking table, causal propagation visualizer, and trace span self-time waterfall.
6. **AI Post-Mortem Report Viewer & Export:** Markdown and PDF viewer rendering executive summaries and remediation runbooks generated by Groq.
7. **Authentication & RBAC Pages:** Login, user registration, and role assignment (`TenantOwner`, `Engineer`, `Viewer`).

---

## 6. Backend Integration Blueprint

The frontend is now prepared to connect to the FastAPI backend:

```
[UI Screen / Hook]
       │
       ▼
[React Query (TanStack Query)]
       │
       ▼
[Typed Service Module (e.g., chaosService, sandboxService)]
       │
       ├── (if VITE_USE_MOCK_DATA === 'true')  ──► [MockTelemetryService]
       │
       └── (if VITE_USE_MOCK_DATA === 'false') ──► [ApiClient (FastAPI REST)]
                                                         │
                                                         ▼
                                                  Bearer JWT Header
                                                  RFC 7807 Error Parsing
```

- When the backend services in Milestone M1/M2 are deployed, setting `VITE_USE_MOCK_DATA=false` immediately switches all data fetching to real FastAPI endpoints without rewriting any screen components.
