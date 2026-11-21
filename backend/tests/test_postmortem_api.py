"""API integration tests for M9 AI Explanations and Postmortems REST endpoints."""

from datetime import datetime, timezone
from uuid import UUID, uuid4
import pytest
from fastapi.testclient import TestClient

from backend.app.core.security import create_access_token
from backend.app.domains.incident.models import (
    IncidentEvidencePackage,
    IncidentRecord,
    IncidentSeverity,
    IncidentStatus,
)
from backend.app.domains.incident.service import _INCIDENT_DB, incident_service
from backend.app.domains.postmortem.models import ActionItemStatus, PostmortemStatus
from backend.app.domains.rca.models import (
    ConfidenceClassification,
    RCAAnalysis,
    RCACandidate,
    RCAEvidence,
    RCAEvidenceType,
)
from backend.app.domains.rca.service import (
    _INCIDENT_RCA_INDEX,
    _RCA_ANALYSES_DB,
    rca_service,
)
from backend.app.main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_tokens():
    tenant_id = str(uuid4())
    owner_user_id = str(uuid4())
    engineer_user_id = str(uuid4())
    viewer_user_id = str(uuid4())

    owner_token = create_access_token(
        user_id=owner_user_id, tenant_id=tenant_id, role="TenantOwner", email="owner@acme.com"
    )
    engineer_token = create_access_token(
        user_id=engineer_user_id, tenant_id=tenant_id, role="Engineer", email="eng@acme.com"
    )
    viewer_token = create_access_token(
        user_id=viewer_user_id, tenant_id=tenant_id, role="Viewer", email="viewer@acme.com"
    )

    return {
        "tenant_id": tenant_id,
        "owner_token": owner_token,
        "engineer_token": engineer_token,
        "viewer_token": viewer_token,
    }


@pytest.fixture
def seeded_incident(auth_tokens):
    tenant_id = auth_tokens["tenant_id"]
    incident_id = uuid4()
    project_id = uuid4()
    sandbox_id = uuid4()
    now = datetime.now(timezone.utc)

    inc = IncidentRecord(
        id=incident_id,
        fingerprint=f"fp-{uuid4().hex[:12]}",
        tenant_id=UUID(tenant_id),
        project_id=project_id,
        sandbox_id=sandbox_id,
        primary_affected_service="checkout-core",
        title="High Latency & Connection Spike",
        description="Downstream timeout breach across payment service and order service.",
        severity=IncidentSeverity.CRITICAL,
        status=IncidentStatus.OPEN,
        first_detected_at=now,
        last_detected_at=now,
        created_at=now,
        updated_at=now,
        evidence_package=IncidentEvidencePackage(),
    )
    _INCIDENT_DB[incident_id] = inc

    cand = RCACandidate(
        candidate_id="cand-payment",
        service_id="payment-service",
        service_name="payment-service",
        score=96.0,
        confidence=ConfidenceClassification.HIGH,
        is_primary_cause=True,
    )
    ev = RCAEvidence(
        evidence_id="ev-trace-test-01",
        evidence_type=RCAEvidenceType.TRACE_LATENCY_SPIKE,
        service_id="payment-service",
        source_reference="jaeger:tr-1234",
    )
    analysis = RCAAnalysis(
        incident_id=incident_id,
        tenant_id=UUID(tenant_id),
        project_id=project_id,
        sandbox_id=sandbox_id,
        primary_root_cause=cand,
        candidates=[cand],
        evidence_items=[ev],
    )
    _RCA_ANALYSES_DB[analysis.id] = analysis
    _INCIDENT_RCA_INDEX[incident_id] = [analysis.id]

    return incident_id


def test_generate_ai_explanation_endpoint(client, auth_tokens, seeded_incident):
    """Test POST /api/v1/incidents/{id}/explanation."""
    headers = {
        "Authorization": f"Bearer {auth_tokens['engineer_token']}",
        "X-Tenant-ID": auth_tokens["tenant_id"],
    }
    resp = client.post(f"/api/v1/incidents/{seeded_incident}/explanation", headers=headers, json={"force_refresh": True})
    assert resp.status_code == 200
    data = resp.json()
    assert data["incident_id"] == str(seeded_incident)
    assert "executive_summary" in data
    assert len(data["recommendations"]) > 0


def test_generate_and_get_postmortem_endpoint(client, auth_tokens, seeded_incident):
    """Test POST and GET /api/v1/incidents/{id}/postmortem."""
    headers = {
        "Authorization": f"Bearer {auth_tokens['engineer_token']}",
        "X-Tenant-ID": auth_tokens["tenant_id"],
    }
    # 1. Generate postmortem
    create_resp = client.post(
        f"/api/v1/incidents/{seeded_incident}/postmortem",
        headers=headers,
        json={"title": "Official Checkout Postmortem", "force_refresh": True},
    )
    assert create_resp.status_code == 200
    pm_data = create_resp.json()
    pm_id = pm_data["id"]
    assert pm_data["status"] == "DRAFT"
    assert pm_data["primary_root_cause_service"] == "payment-service"

    # 2. Get postmortem by incident ID
    get_by_inc = client.get(f"/api/v1/incidents/{seeded_incident}/postmortem", headers=headers)
    assert get_by_inc.status_code == 200
    assert get_by_inc.json()["id"] == pm_id

    # 3. Get postmortem by report ID
    get_by_id = client.get(f"/api/v1/postmortems/{pm_id}", headers=headers)
    assert get_by_id.status_code == 200
    assert get_by_id.json()["id"] == pm_id


def test_pdf_export_endpoint(client, auth_tokens, seeded_incident):
    """Test GET /api/v1/postmortems/{id}/pdf returns binary PDF."""
    headers = {
        "Authorization": f"Bearer {auth_tokens['viewer_token']}",
        "X-Tenant-ID": auth_tokens["tenant_id"],
    }
    # Generate first
    eng_headers = {
        "Authorization": f"Bearer {auth_tokens['engineer_token']}",
        "X-Tenant-ID": auth_tokens["tenant_id"],
    }
    create_resp = client.post(f"/api/v1/incidents/{seeded_incident}/postmortem", headers=eng_headers)
    pm_id = create_resp.json()["id"]

    # Download PDF with viewer token
    pdf_resp = client.get(f"/api/v1/postmortems/{pm_id}/pdf", headers=headers)
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert pdf_resp.content.startswith(b"%PDF-")


def test_update_action_item_endpoint(client, auth_tokens, seeded_incident):
    """Test PATCH /api/v1/postmortems/{id}/action-items/{item_id}."""
    headers = {
        "Authorization": f"Bearer {auth_tokens['engineer_token']}",
        "X-Tenant-ID": auth_tokens["tenant_id"],
    }
    create_resp = client.post(f"/api/v1/incidents/{seeded_incident}/postmortem", headers=headers)
    pm_id = create_resp.json()["id"]
    action_item = create_resp.json()["action_items"][0]
    act_id = action_item["id"]

    patch_resp = client.patch(
        f"/api/v1/postmortems/{pm_id}/action-items/{act_id}",
        headers=headers,
        json={"status": "IN_PROGRESS", "assigned_to": "alice@acme.com", "due_date": "2026-12-01"},
    )
    assert patch_resp.status_code == 200
    updated_items = patch_resp.json()["action_items"]
    target = next(it for it in updated_items if it["id"] == act_id)
    assert target["status"] == "IN_PROGRESS"
    assert target["assigned_to"] == "alice@acme.com"


def test_rbac_approval_and_publishing_enforcement(client, auth_tokens, seeded_incident):
    """Verify Viewer/Engineer cannot approve/publish; only TenantOwner can."""
    eng_headers = {
        "Authorization": f"Bearer {auth_tokens['engineer_token']}",
        "X-Tenant-ID": auth_tokens["tenant_id"],
    }
    viewer_headers = {
        "Authorization": f"Bearer {auth_tokens['viewer_token']}",
        "X-Tenant-ID": auth_tokens["tenant_id"],
    }
    owner_headers = {
        "Authorization": f"Bearer {auth_tokens['owner_token']}",
        "X-Tenant-ID": auth_tokens["tenant_id"],
    }

    # Generate as Engineer
    create_resp = client.post(f"/api/v1/incidents/{seeded_incident}/postmortem", headers=eng_headers)
    pm_id = create_resp.json()["id"]

    # Viewer tries to approve -> 403 Forbidden
    v_resp = client.post(f"/api/v1/postmortems/{pm_id}/approve", headers=viewer_headers)
    assert v_resp.status_code == 403

    # Engineer tries to approve -> 403 Forbidden
    e_resp = client.post(f"/api/v1/postmortems/{pm_id}/approve", headers=eng_headers)
    assert e_resp.status_code == 403

    # TenantOwner approves -> 200 OK
    o_resp = client.post(f"/api/v1/postmortems/{pm_id}/approve", headers=owner_headers)
    assert o_resp.status_code == 200
    assert o_resp.json()["status"] == "APPROVED"

    # TenantOwner publishes -> 200 OK
    pub_resp = client.post(f"/api/v1/postmortems/{pm_id}/publish", headers=owner_headers)
    assert pub_resp.status_code == 200
    assert pub_resp.json()["status"] == "PUBLISHED"


def test_tenant_isolation_boundary(client, auth_tokens, seeded_incident):
    """Verify cross-tenant requests cannot access postmortem data."""
    eng_headers = {
        "Authorization": f"Bearer {auth_tokens['engineer_token']}",
        "X-Tenant-ID": auth_tokens["tenant_id"],
    }
    create_resp = client.post(f"/api/v1/incidents/{seeded_incident}/postmortem", headers=eng_headers)
    pm_id = create_resp.json()["id"]

    # Another tenant tries to access
    foreign_tenant_id = str(uuid4())
    foreign_headers = {
        "Authorization": f"Bearer {auth_tokens['owner_token']}",
        "X-Tenant-ID": foreign_tenant_id,
    }
    foreign_get = client.get(f"/api/v1/postmortems/{pm_id}", headers=foreign_headers)
    assert foreign_get.status_code == 404
