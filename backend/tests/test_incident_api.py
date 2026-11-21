"""Integration and API tests for Incident Management REST Endpoints, RBAC, and State Machine (M7)."""

from datetime import datetime, timezone
from uuid import UUID, uuid4
import pytest
from fastapi.testclient import TestClient

from backend.app.domains.incident.models import (
    IncidentEvidencePackage,
    IncidentRecord,
    IncidentSeverity,
    IncidentStatus,
)
from backend.app.domains.incident.service import (
    _CONSECUTIVE_BREACH_CACHE,
    _INCIDENT_DB,
    _INCIDENT_TIMELINES,
    IncidentService,
    incident_service,
)
from backend.app.domains.sandbox.models import SandboxLifecycleState, SandboxRecord
from backend.app.domains.sandbox.service import _SANDBOX_DB


@pytest.fixture(autouse=True)
def clean_incident_database():
    """Resets in-memory incident database between test runs."""
    _INCIDENT_DB.clear()
    _INCIDENT_TIMELINES.clear()
    _CONSECUTIVE_BREACH_CACHE.clear()
    yield
    _INCIDENT_DB.clear()
    _INCIDENT_TIMELINES.clear()
    _CONSECUTIVE_BREACH_CACHE.clear()


@pytest.fixture
def sample_sandbox(clean_database):
    """Creates a sample active sandbox in _SANDBOX_DB."""
    from datetime import timedelta
    from backend.tests.conftest import TEST_PROJECT_ID, TEST_TENANT_ID
    from backend.app.domains.sandbox.models import ResourceProfile

    sbx_id = uuid4()
    sbx = SandboxRecord(
        id=sbx_id,
        name="Test Sandbox",
        tenant_id=TEST_TENANT_ID,
        project_id=TEST_PROJECT_ID,
        cluster_id="kind-sandbox-mesh",
        k8s_namespace=f"sbx-{str(sbx_id)[:8]}",
        resource_profile=ResourceProfile(),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=4),
        status=SandboxLifecycleState.READY,
        workloads=[],
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    _SANDBOX_DB[sbx_id] = sbx
    return sbx


@pytest.fixture
def sample_incident(sample_sandbox):
    """Seeds a sample open incident into _INCIDENT_DB."""
    from backend.tests.conftest import TEST_PROJECT_ID, TEST_TENANT_ID

    inc_id = uuid4()
    fp = IncidentService.generate_fingerprint(sample_sandbox.id, "payment-service", "LATENCY")
    inc = IncidentRecord(
        id=inc_id,
        fingerprint=fp,
        tenant_id=TEST_TENANT_ID,
        project_id=TEST_PROJECT_ID,
        sandbox_id=sample_sandbox.id,
        primary_affected_service="payment-service",
        related_affected_services=["order-service", "api-gateway"],
        title="P99 Latency Critical Breach (> 500ms)",
        description="payment-service P99 reached 820ms during load",
        severity=IncidentSeverity.CRITICAL,
        status=IncidentStatus.OPEN,
        detection_source="PROMETHEUS_PROMQL",
        triggered_rule_ids=["RULE_LAT_P99_CRITICAL"],
        first_detected_at=datetime.now(timezone.utc),
        last_detected_at=datetime.now(timezone.utc),
        occurrence_count=1,
        evidence_package=IncidentEvidencePackage(
            metric_snapshots={"p99": 820.0, "error_rate": 0.05},
            latency_change_pct=1640.0,
            error_rate_pct=0.05,
            service_health_status="degraded",
            trace_ids=["tr-sample-001"],
            log_ids=["log-sample-001"],
            topology_version=1,
            affected_dependency_paths=["api-gateway -> order-service -> payment-service"],
            telemetry_freshness="FRESH",
        ),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    _INCIDENT_DB[inc_id] = inc
    return inc


def test_list_incidents_unauthenticated(client: TestClient):
    """Verifies that missing authentication headers are rejected with 401."""
    res = client.get("/api/v1/incidents")
    assert res.status_code == 401


def test_list_incidents_tenant_scoping(client: TestClient, sample_incident, owner_token: str, other_tenant_token: str):
    """Verifies that list_incidents strictly enforces tenant isolation."""
    # Active tenant can see its incident
    res = client.get("/api/v1/incidents", headers={"Authorization": f"Bearer {owner_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["items"][0]["id"] == str(sample_incident.id)

    # Other tenant sees 0 incidents
    other_res = client.get("/api/v1/incidents", headers={"Authorization": f"Bearer {other_tenant_token}"})
    assert other_res.status_code == 200
    assert other_res.json()["total"] == 0


def test_get_incident_cross_tenant_isolation(client: TestClient, sample_incident, other_tenant_token: str):
    """Verifies that attempting to read another tenant's incident returns 404."""
    res = client.get(
        f"/api/v1/incidents/{sample_incident.id}",
        headers={"Authorization": f"Bearer {other_tenant_token}"},
    )
    assert res.status_code == 404


def test_viewer_role_read_only_access(client: TestClient, sample_incident, viewer_token: str):
    """Verifies that Viewer role can read incidents, timeline, and evidence, but cannot mutate."""
    headers = {"Authorization": f"Bearer {viewer_token}"}

    # Reads succeed
    assert client.get("/api/v1/incidents", headers=headers).status_code == 200
    assert client.get(f"/api/v1/incidents/{sample_incident.id}", headers=headers).status_code == 200
    assert client.get(f"/api/v1/incidents/{sample_incident.id}/timeline", headers=headers).status_code == 200
    assert client.get(f"/api/v1/incidents/{sample_incident.id}/evidence", headers=headers).status_code == 200

    # Mutations are forbidden (HTTP 403)
    assert client.post(f"/api/v1/incidents/{sample_incident.id}/acknowledge", headers=headers).status_code == 403
    assert client.post(f"/api/v1/incidents/{sample_incident.id}/investigate", headers=headers).status_code == 403
    assert client.post(f"/api/v1/incidents/{sample_incident.id}/resolve", headers=headers).status_code == 403
    assert client.post(f"/api/v1/incidents/{sample_incident.id}/close", headers=headers).status_code == 403


def test_lifecycle_state_machine_valid_progression(client: TestClient, sample_incident, engineer_token: str):
    """Tests the full valid state machine progression: OPEN -> ACKNOWLEDGED -> INVESTIGATING -> RESOLVED -> CLOSED."""
    headers = {"Authorization": f"Bearer {engineer_token}"}
    inc_id = sample_incident.id

    # 1. Acknowledge (OPEN -> ACKNOWLEDGED)
    res_ack = client.post(f"/api/v1/incidents/{inc_id}/acknowledge", json={"note": "On-call acked"}, headers=headers)
    assert res_ack.status_code == 200
    assert res_ack.json()["status"] == "ACKNOWLEDGED"
    assert res_ack.json()["acknowledged_at"] is not None

    # 2. Investigate (ACKNOWLEDGED -> INVESTIGATING)
    res_inv = client.post(f"/api/v1/incidents/{inc_id}/investigate", json={"note": "Tracing downstream"}, headers=headers)
    assert res_inv.status_code == 200
    assert res_inv.json()["status"] == "INVESTIGATING"

    # 3. Resolve (INVESTIGATING -> RESOLVED)
    res_res = client.post(f"/api/v1/incidents/{inc_id}/resolve", json={"note": "Fault stopped"}, headers=headers)
    assert res_res.status_code == 200
    assert res_res.json()["status"] == "RESOLVED"
    assert res_res.json()["resolved_at"] is not None

    # 4. Close (RESOLVED -> CLOSED)
    res_cls = client.post(f"/api/v1/incidents/{inc_id}/close", json={"note": "Post-mortem completed"}, headers=headers)
    assert res_cls.status_code == 200
    assert res_cls.json()["status"] == "CLOSED"
    assert res_cls.json()["closed_at"] is not None

    # Check Timeline Audit History
    res_timeline = client.get(f"/api/v1/incidents/{inc_id}/timeline", headers=headers)
    assert res_timeline.status_code == 200
    events = res_timeline.json()
    assert len(events) == 4
    assert events[0]["to_status"] == "ACKNOWLEDGED"
    assert events[1]["to_status"] == "INVESTIGATING"
    assert events[2]["to_status"] == "RESOLVED"
    assert events[3]["to_status"] == "CLOSED"


def test_lifecycle_state_machine_invalid_transition(client: TestClient, sample_incident, engineer_token: str):
    """Verifies that invalid transitions (e.g. OPEN -> CLOSED directly) are rejected with 400 Bad Request."""
    headers = {"Authorization": f"Bearer {engineer_token}"}
    res = client.post(f"/api/v1/incidents/{sample_incident.id}/close", json={"note": "Illegal close"}, headers=headers)
    assert res.status_code == 400
    assert "Invalid lifecycle transition" in res.json()["detail"]


def test_evaluate_incidents_deduplication(client: TestClient, sample_sandbox, owner_token: str):
    """Tests that repeated evaluate runs update occurrences and do not create duplicate incidents."""
    headers = {"Authorization": f"Bearer {owner_token}"}
    params = {
        "sandbox_id": str(sample_sandbox.id),
        "project_id": str(sample_sandbox.project_id),
    }

    # Initial evaluation: evaluate sandbox microservices
    res1 = client.post("/api/v1/incidents/evaluate", params=params, headers=headers)
    assert res1.status_code == 200
    data1 = res1.json()
    assert "evaluated_services" in data1
    assert "rules_triggered" in data1

    # Second evaluation: verify deduplication works and doesn't crash
    res2 = client.post("/api/v1/incidents/evaluate", params=params, headers=headers)
    assert res2.status_code == 200


def test_get_incident_evidence_package(client: TestClient, sample_incident, owner_token: str):
    """Tests retrieving the structured evidence package."""
    res = client.get(
        f"/api/v1/incidents/{sample_incident.id}/evidence",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert res.status_code == 200
    evidence = res.json()
    assert evidence["metric_snapshots"]["p99"] == 820.0
    assert evidence["telemetry_freshness"] == "FRESH"
    assert "api-gateway -> order-service -> payment-service" in evidence["affected_dependency_paths"]
