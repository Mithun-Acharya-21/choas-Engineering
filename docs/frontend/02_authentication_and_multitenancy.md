# Milestone M2 — Authentication & Multi-Tenancy Architecture Report

## ChaosEngine AI — Mission-Control Resilience & Telemetry Platform

**Document Version:** 1.0.0  
**Status:** Completed & Validated  
**Target Milestone:** M2 (Authentication & Multi-Tenancy)  
**Security Posture:** In-Memory JWT Access Token + HttpOnly Refresh Lifecycle Ready + Multi-Tenant Scoping Invariants

---

## 1. Architectural Overview

Milestone M2 establishes the complete security, identity, and multi-tenant scoping boundary for the ChaosEngine AI frontend without rewriting or altering the established **Obsidian Telemetry** design system (`#09090b` canvas, `#111113` cards, `#18181b` elevation, `#27272a` borders, `#6366f1` accent, JetBrains Mono / Inter typography).

```
                      ┌────────────────────────────────────────┐
                      │          React 19 / Vite App           │
                      └──────────────────┬─────────────────────┘
                                         │
                         ┌───────────────▼───────────────┐
                         │      QueryClientProvider      │
                         └───────────────┬───────────────┘
                                         │
                         ┌───────────────▼───────────────┐
                         │         BrowserRouter         │
                         └───────────────┬───────────────┘
                                         │
                         ┌───────────────▼───────────────┐
                         │       AuthProvider (M2)       │
                         │  - In-Memory Access Token     │
                         │  - Active Tenant UUID Scope   │
                         │  - Active Project UUID Scope  │
                         │  - RBAC Role & Permissions    │
                         └───────────────┬───────────────┘
                                         │
                         ┌───────────────▼───────────────┐
                         │       TelemetryProvider       │
                         └───────────────┬───────────────┘
                                         │
                         ┌───────────────▼───────────────┐
                         │           AppRoutes           │
                         │  Public: /login, /register    │
                         │  Protected: <ProtectedRoute>  │
                         └───────────────────────────────┘
```

---

## 2. Authentication Architecture & Security Lifecycle

### 2.1 Token Storage & Memory Isolation
- **Defense Against XSS Token Theft:** Sensitive JWT access tokens are stored strictly **in JavaScript memory** (`useState` in `AuthContext`). They are never persisted to `localStorage`.
- **Session Restoration:** On reload or page navigation, `sessionStorage` maintains an ephemeral session pointer (`chaos_session_token`, `chaos_user_email`, `chaos_active_tenant_id`, `chaos_active_project_id`). This ensures browser reloads do not log out engineers, while closing the tab or browser clears the session.
- **Production Cookie Baseline:** When connected to the live FastAPI backend, the refresh token lifecycle uses `HttpOnly; SameSite=Strict; Secure` cookies managed by the backend on `/api/v1/auth/refresh`.

### 2.2 Centralized Request Injection
`apiClient.ts` dynamically queries the in-memory token provider and tenant provider on every request:
```typescript
// Authorization Header Injection
if (this.tokenProvider) {
  const token = this.tokenProvider();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
}

// Multi-Tenant Isolation Header Injection
if (this.tenantProvider) {
  const tenantId = this.tenantProvider();
  if (tenantId) {
    headers['X-Tenant-ID'] = tenantId;
  }
}
```

### 2.3 Session Expiration & 401 Interception
When any API call returns `401 Unauthorized`:
1. `apiClient` triggers the registered `onUnauthorized` callback.
2. `AuthContext.logout()` executes:
   - Clears in-memory JWT access token and user state.
   - Clears `sessionStorage`.
   - Clears active tenant and project scopes.
3. React Router redirects the user to `/login` preserving `location.state.from` for post-login return.

---

## 3. Multi-Tenancy Architecture & Scoping Invariants

### 3.1 Multi-Tenant Invariant
Every tenant-owned resource (projects, sandboxes, workloads, experiments, telemetry series, incidents, reports) is strictly scoped to the authenticated user's authorized `activeTenant.id` and `activeProject.id`.
- Frontend dropdowns allow authorized users to switch between tenant organizations and scoped projects.
- Context switching immediately updates `X-Tenant-ID` in the API client and re-queries scoped project resources.
- **Security Invariant:** The frontend never assumes browser-supplied tenant IDs or project IDs are inherently trusted; the backend independently validates caller membership and JWT claims on every endpoint.

### 3.2 Tenant & Project Workspace Hierarchy
```
Tenant Organization (e.g. Acme Corp Platform)
 └── Projects (e.g. E-Commerce Checkout Resilience, Core Payment Gateway Mesh)
      └── Isolated Sandboxes (e.g. sandbox-alpha-us-east-1)
           └── Workloads & Chaos Experiments
```

---

## 4. Role-Based Access Control (RBAC)

The application supports three discrete organizational roles conforming to the backend contract:

| Permission | TenantOwner | Engineer | Viewer | Purpose / Scope |
| :--- | :---: | :---: | :---: | :--- |
| `org:admin` | **Yes** | No | No | Create/delete tenants, invite members, modify roles |
| `project:manage` | **Yes** | **Yes** | No | Create, configure, and delete projects |
| `project:view` | **Yes** | **Yes** | **Yes** | View projects in active tenant |
| `sandbox:operate` | **Yes** | **Yes** | No | Provision, modify, and teardown Kubernetes sandboxes |
| `sandbox:view` | **Yes** | **Yes** | **Yes** | Inspect sandbox topology, metrics, and logs |
| `chaos:execute` | **Yes** | **Yes** | No | Launch, configure, and emergency halt chaos experiments |
| `incident:manage` | **Yes** | **Yes** | No | Acknowledge, triage, and trigger deterministic RCA |
| `report:view` | **Yes** | **Yes** | **Yes** | Read and download post-mortem incident reports |
| `report:approve` | **Yes** | No | No | Sign-off and approve post-mortem remediation action items |
| `audit:view` | **Yes** | No | No | View immutable compliance audit trail |

### 4.1 UI Permission Enforcement
- **Chaos Lab Screen (`ChaosLabScreen.tsx`):** If caller role is `Viewer`, the "Launch Sandbox Experiment" button is disabled with a `[Read-Only]` badge, and a persistent security notice explains that elevated membership is required.
- **Emergency Halt Controls (`TopBar.tsx`):** Emergency sandbox kill switches are visible and operational only for callers possessing `chaos:execute`.
- **Mesh Topology & Inspector Drawer:** Quick latency injection (+200ms) and individual pod fault halting are disabled for read-only Viewers.
- **Tenant Administration:** Tenant creation and member role modifications are restricted to `TenantOwner`.

---

## 5. UI Components & Screen Implementations

### 5.1 Authentication Screens
1. **LoginPage (`src/features/auth/LoginPage.tsx`):**
   - Obsidian dark palette with subtle radial backdrop blur.
   - Corporate email and password inputs with password toggle visibility.
   - Inline error alert for failed authentication attempts.
   - Demo credentials quick-fill pills:
     * `sre.lead@acme.com` (TenantOwner)
     * `dev.engineer@acme.com` (Engineer)
     * `auditor.compliance@acme.com` (Viewer)
   - Deep-link preservation (`location.state.from`).
2. **RegisterPage (`src/features/auth/RegisterPage.tsx`):**
   - Full Name, Corporate Email, Organization / Tenant Name, and Password.
   - Client-side validation enforcing password length $\ge 10$ characters (conforming to functional requirement FR-001).
   - Automatically initializes tenant organization boundary and provisions the user as `TenantOwner`.
3. **ProtectedRoute (`src/features/auth/ProtectedRoute.tsx`):**
   - Defense-in-depth route guard.
   - Displays animated loading state during session restoration.
   - Redirects unauthenticated traffic to `/login`.
   - Displays Obsidian-styled 403 Forbidden screen when user lacks the required `TenantRole` or `AppPermission`.

### 5.2 Multi-Tenancy Components
1. **TenantSwitcher (`src/features/tenants/TenantSwitcher.tsx`):**
   - Compact dropdown embedded in the sidebar header.
   - Displays active tenant name, tenant slug, and active role badge.
   - Includes "New Tenant" action for `TenantOwner` role.
2. **ProjectSwitcher (`src/features/projects/ProjectSwitcher.tsx`):**
   - Displays active project and active sandbox counts.
   - Lists only projects scoped to the currently selected tenant.
   - Includes "Create Project" action for `TenantOwner` and `Engineer`.
3. **SettingsPage (`src/features/settings/SettingsPage.tsx`):**
   - Full workspace settings dashboard mounted at `/settings`.
   - Tenant Organization Card (Tier, UUID, Slug, Created timestamp).
   - Project List with sandbox counts and creation triggers.
   - Organization Membership Directory with member emails, role badges, and join dates.
   - User Profile Card with current active session details and single-click Logout.

---

## 6. Verification & Test Execution Summary

### 6.1 Vitest Suite Execution
All 34 tests across 8 test suites passed successfully:

```
 RUN  v3.2.7 C:/Users/mh129/OneDrive/Desktop/ALL DESKTOP/choas-Engineering-platform

 ✓ tests/apiErrorHandling.test.ts (3 tests)
 ✓ tests/emergencyHalt.test.ts (1 test)
 ✓ tests/experimentState.test.ts (4 tests)
 ✓ tests/safetyGuardrails.test.ts (4 tests)
 ✓ tests/auth.test.tsx (5 tests)
 ✓ tests/multiTenancy.test.tsx (4 tests)
 ✓ tests/rbac.test.tsx (7 tests)
 ✓ tests/navigation.test.tsx (6 tests)

 Test Files  8 passed (8)
      Tests  34 passed (34)
   Duration  7.94s
```

### 6.2 Test Coverage Highlights
- **`tests/auth.test.tsx`**: Login success, login rejection on invalid password, session restoration from `sessionStorage`, logout state clearing, password length $\ge 10$ validation.
- **`tests/multiTenancy.test.tsx`**: Initial tenant/project scoping, switching active tenant updating project list, switching active project within tenant, tenant creation and auto-activation.
- **`tests/rbac.test.tsx`**: Comprehensive permission matrix logic, ProtectedRoute 403 blocking on unauthorized roles, UI button disabling in ChaosLabScreen for Viewers.
- **`tests/navigation.test.tsx`**: Route rendering for authenticated sessions, unauthenticated redirect to `/login`.
- **`tests/safetyGuardrails.test.ts`**: Sandbox-only namespace restrictions, production cluster blocking, blast radius bounds.

### 6.3 TypeScript & Production Build
- `pnpm exec tsc --noEmit` exited with code `0` (zero type errors).
- `pnpm run build` produced optimized production bundle:
  * `dist/index.html` (1.53 kB)
  * `dist/assets/index-DRVrUDbS.css` (35.52 kB)
  * `dist/assets/index-DtrrBjV8.js` (436.33 kB)

---

## 7. Remaining Backend Dependencies for Milestone M3

The frontend is fully wired to integrate with the FastAPI backend when `VITE_USE_MOCK_DATA="false"`. The following backend endpoints are expected for Milestone M3:
1. `POST /api/v1/auth/register` (body: `email`, `password`, `full_name`, `tenant_name`)
2. `POST /api/v1/auth/login` (body: `username`, `password`)
3. `POST /api/v1/auth/refresh` (cookie: refresh token)
4. `GET /api/v1/tenants` & `POST /api/v1/tenants`
5. `GET /api/v1/projects` & `POST /api/v1/projects`
6. `POST /api/v1/sandboxes` (Milestone M3 Kubernetes sandbox provisioning)
