# AI Validation & Automated Testing Guide (Milestone M9)

## 1. Testing Strategy

Milestone M9 enforces 100% automated test coverage across both backend and frontend layers:

1. **Deterministic Execution**:
   Testing uses `MockLLMProvider`, eliminating network latency, quota consumption, and external API flakiness.
2. **Safety & Injection Defense**:
   Adversarial prompt injection strings in mock telemetry are validated to confirm prompt neutralization.
3. **Evidence Citation Verification**:
   Valid and fake evidence markers are injected into test responses to confirm that hallucinations are detected and flagged.
4. **RBAC & Multi-Tenancy**:
   FastAPI endpoints are exercised with `Viewer`, `Engineer`, and `TenantOwner` JWTs, verifying strict HTTP 403 Forbidden enforcement on approval/publication endpoints and HTTP 404 on cross-tenant requests.
5. **PDF Export Byte Stream**:
   Unit tests verify that `export_pdf` returns non-empty binary bytes starting with standard `%PDF-` header magic.

---

## 2. Test Execution Commands

### Backend Pytest Suite (107 Tests)
```powershell
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD="1"
python -m pytest backend/tests -v
```

Key test files:
- `backend/tests/test_postmortem_ai.py`: Evidence sanitization, citation verification, fallback generation, and PDF export.
- `backend/tests/test_postmortem_api.py`: FastAPI endpoints, JWT auth, tenant isolation, and RBAC governance.

### Frontend Vitest Suite (69 Tests across 14 Suites)
```powershell
pnpm exec vitest run
```

Key test files:
- `tests/postmortems.test.tsx`: Postmortem workspace rendering, tab navigation, action item additions, and PDF export trigger.
- `tests/navigation.test.tsx`: Route integration for `/reports` in Milestone M9.

### TypeScript Compilation & Production Bundle Build
```powershell
pnpm exec tsc --noEmit
pnpm run build
```
All commands execute with zero errors.
