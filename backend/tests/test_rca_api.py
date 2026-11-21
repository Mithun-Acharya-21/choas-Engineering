"""Integration and API tests for Deterministic RCA REST Endpoints, RBAC, and Tenant Isolation (M8)."""

from datetime import datetime, timezone
from uuid import UUID, uuid4
import pytest
from fastapi.testclient import TestClient

from backend.app.domains.incident.models import IncidentEvidencePackage, IncidentRecord, IncidentSeverity, IncidentStatus
from backend.app.domains.incident.service import _INCIDENT_DB
from backend.app.domains.rca.service import _INCIDENT_RCA_INDEX, _RCA_ANALYSES_DB


@pytest.fixture(autouse=True)
def clean_rca_database():
    """Resets in-memory RCA repository between test runs."""
    _RCA_ANALYSES_DB.clear()
    _INCIDENT_RCA_INDEX.clear()
    yield
    _RCA_ANALYSES_DB.clear()
    _INCIDENT_RCA_INDEX.clear()


@pytest.fixture
def active_incident():
    """Seeds an active M7 incident into _INCIDENT_DB."""
    from backend.tests.conftest import TEST_PROJECT_ID, TEST_TENANT_ID

    inc_id = uuid4()
    sbx_id = uuid4()
    now = datetime.now(timezone.utc)
    inc = IncidentRecord(
        id=inc_id,
        fingerprint="fp-8f12d8a0c4",
        tenant_id=TEST_TENANT_ID,
        project_id=TEST_PROJECT_ID,
        sandbox_id=sbx_id,
        primary_affected_service="payment-service",
        related_affected_services=["order-service", "api-gateway"],
        related_experiment_id="exp-9411",
        title="P99 Latency Critical Breach (> 500ms)",
        description="payment-service P99 reached 842ms during load",
        severity=IncidentSeverity.CRITICAL,
        status=IncidentStatus.OPEN,
        detection_source="PROMETHEUS_PROMQL",
        triggered_rule_ids=["RULE_LAT_P99_CRITICAL"],
        first_detected_at=now,
        last_detected_at=now,
        occurrence_count=3,
        evidence_package=IncidentEvidencePackage(
            metric_snapshots={"p99": 842.0, "error_rate": 7.8},
            latency_change_pct=2530.0,
            error_rate_pct=7.8,
            service_health_status="degraded",
            trace_ids=["tr-89f2c4a10e"],
            log_ids=["log-1084"],
            topology_version=1,
            affected_dependency_paths=["api-gateway -> order-service -> payment-service"],
            related_experiment_id="exp-9411",
            experiment_fault_type="LATENCY_INJECTION",
            experiment_magnitude=500.0,
            started_relative_to_experiment="during",
            telemetry_freshness="FRESH",
        ),
        created_at=now,
        updated_at=now,
    )
    _INCIDENT_DB[inc_id] = inc
    return inc


def test_rca_analyze_unauthenticated(client: TestClient, active_incident):
    """Verifies that missing authentication headers return HTTP 401."""
    res = client.post(f"/api/v1/incidents/{active_incident.id}/rca/analyze")
    assert res.status_code == 401


def test_rca_analyze_and_candidate_retrieval(client: TestClient, active_incident, engineer_token: str):
    """Tests triggering RCA analysis and verifying candidate ranking."""
    headers = {"Authorization": f"Bearer {engineer_token}"}

    # 1. Trigger RCA Analysis
    res = client.post(f"/api/v1/incidents/{active_incident.id}/rca/analyze", headers=headers)
    assert res.status_code == 200
    data = res.json()
    analysis_id = data["id"]
    assert data["incident_id"] == str(active_incident.id)
    assert data["status"] == "COMPLETED"
    assert data["primary_root_cause"] is not None
    assert data["primary_root_cause"]["service_id"] == "payment-service"
    assert data["primary_root_cause"]["score"] > 60.0

    # 2. Retrieve Candidate List via /candidates
    res_cand = client.get(f"/api/v1/rca/{analysis_id}/candidates", headers=headers)
    assert res_cand.status_code == 200
    cand_data = res_cand.json()
    assert cand_data["analysis_id"] == analysis_id
    assert cand_data["primary_root_cause"]["service_id"] == "payment-service"
    assert len(cand_data["candidates"]) >= 2
    assert len(cand_data["collateral_symptoms"]) >= 1

    # 3. Retrieve Normalized Evidence Items via /evidence
    res_ev = client.get(f"/api/v1/rca/{analysis_id}/evidence", headers=headers)
    assert res_ev.status_code == 200
    assert len(res_ev.json()) >= 1

    # 4. Retrieve Propagation Paths via /propagation
    res_prop = client.get(f"/api/v1/rca/{analysis_id}/propagation", headers=headers)
    assert res_prop.status_code == 200
    assert res_prop.json()["primary_fault_origin"] == "payment-service"
    assert len(res_prop.json()["paths"]) >= 1


def test_rca_idempotency_and_rerun(client: TestClient, active_incident, engineer_token: str):
    """Verifies idempotent caching and versioned re-run functionality."""
    headers = {"Authorization": f"Bearer {engineer_token}"}

    # Initial Run
    res1 = client.post(f"/api/v1/incidents/{active_incident.id}/rca/analyze", headers=headers)
    assert res1.status_code == 200
    id1 = res1.json()["id"]

    # Second call returns identical cached analysis ID
    res2 = client.post(f"/api/v1/incidents/{active_incident.id}/rca/analyze", headers=headers)
    assert res2.status_code == 200
    assert res2.json()["id"] == id1

    # Explicit Re-run with custom algorithm version creates a new historical analysis
    rerun_payload = {"algorithm_version": "v1.1.0-latency-heavy"}
    res_rerun = client.post(f"/api/v1/rca/{id1}/rerun", json=rerun_payload, headers=headers)
    assert res_rerun.status_code == 200
    id2 = res_rerun.json()["id"]
    assert id2 != id1
    assert res_rerun.json()["execution_metadata"]["algorithm_version"] == "v1.1.0-latency-heavy"


def test_rca_tenant_isolation(client: TestClient, active_incident, engineer_token: str, other_tenant_token: str):
    """Verifies that other tenants cannot analyze or access RCA records."""
    headers_owner = {"Authorization": f"Bearer {engineer_token}"}
    headers_other = {"Authorization": f"Bearer {other_tenant_token}"}

    # Run analysis as tenant owner
    res = client.post(f"/api/v1/incidents/{active_incident.id}/rca/analyze", headers=headers_owner)
    assert res.status_code == 200
    analysis_id = res.json()["id"]

    # Cross-tenant access attempts return 404
    assert client.get(f"/api/v1/rca/{analysis_id}", headers=headers_other).status_code == 404
    assert client.get(f"/api/v1/incidents/{active_incident.id}/rca", headers=headers_other).status_code == 404
    assert client.post(f"/api/v1/incidents/{active_incident.id}/rca/analyze", headers=headers_other).status_code == 404


def test_rca_viewer_read_only_rbac(client: TestClient, active_incident, engineer_token: str, viewer_token: str):
    """Verifies that Viewer role can read RCA analyses and candidates, but cannot trigger analyze or rerun."""
    headers_eng = {"Authorization": f"Bearer {engineer_token}"}
    headers_view = {"Authorization": f"Bearer {viewer_token}"}

    # Engineer triggers analysis
    res = client.post(f"/api/v1/incidents/{active_incident.id}/rca/analyze", headers=headers_eng)
    assert res.status_code == 200
    analysis_id = res.json()["id"]

    # Viewer can read analysis, candidates, evidence, and propagation
    assert client.get(f"/api/v1/incidents/{active_incident.id}/rca", headers=headers_view).status_code == 200
    assert client.get(f"/api/v1/rca/{analysis_id}", headers=headers_view).status_code == 200
    assert client.get(f"/api/v1/rca/{analysis_id}/candidates", headers=headers_view).status_code == 200
    assert client.get(f"/api/v1/rca/{analysis_id}/evidence", headers=headers_view).status_code == 200
    assert client.get(f"/api/v1/rca/{analysis_id}/propagation", headers=headers_view).status_code == 200

    # Viewer cannot trigger analyze or rerun (HTTP 403)
    assert client.post(f"/api/v1/incidents/{active_incident.id}/rca/analyze", headers=headers_view).status_code == 403
    assert client.post(f"/api/v1/rca/{analysis_id}/rerun", json={"algorithm_version": "v1.0.0"}, headers=headers_view).status_code == 403
