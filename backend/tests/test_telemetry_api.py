"""Integration tests for ChaosEngine AI Telemetry & Observability API endpoints (Milestone M6)."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient

from backend.app.domains.sandbox.models import (
    ResourceProfile,
    SandboxLifecycleState,
    SandboxRecord,
)
from backend.app.domains.sandbox.service import _SANDBOX_DB
from backend.tests.conftest import (
    OTHER_TENANT_ID,
    TEST_PROJECT_ID,
    TEST_TENANT_ID,
)


@pytest.fixture
def active_sandbox() -> SandboxRecord:
    """Pre-populates an active READY sandbox in the test database."""
    now = datetime.now(timezone.utc)
    sbx_id = uuid4()
    record = SandboxRecord(
        id=sbx_id,
        tenant_id=TEST_TENANT_ID,
        project_id=TEST_PROJECT_ID,
        name="Telemetry Lab Sandbox Alpha",
        k8s_namespace="sandbox-telemetry-01",
        cluster_id="sandbox-alpha-us-east-1",
        resource_profile=ResourceProfile(),
        status=SandboxLifecycleState.READY,
        is_isolated=True,
        expires_at=now + timedelta(hours=4),
        created_at=now,
        updated_at=now,
    )
    _SANDBOX_DB[sbx_id] = record
    return record


def test_unauthenticated_request_rejected(client: TestClient, active_sandbox: SandboxRecord):
    """Verifies unauthenticated requests to telemetry endpoints return 401."""
    resp = client.get(f"/api/v1/telemetry/metrics?sandbox_id={active_sandbox.id}")
    assert resp.status_code == 401


def test_cross_tenant_access_blocked(client: TestClient, active_sandbox: SandboxRecord, other_tenant_token: str):
    """Verifies cross-tenant queries return 404 per security boundaries."""
    headers = {
        "Authorization": f"Bearer {other_tenant_token}",
        "X-Tenant-ID": str(OTHER_TENANT_ID),
    }
    resp = client.get(
        f"/api/v1/telemetry/metrics?sandbox_id={active_sandbox.id}",
        headers=headers,
    )
    assert resp.status_code == 404
    assert "not found in active tenant" in resp.json()["detail"]


def test_get_metrics_success(client: TestClient, active_sandbox: SandboxRecord, viewer_token: str):
    """Verifies viewer role can query metric time-series."""
    headers = {
        "Authorization": f"Bearer {viewer_token}",
        "X-Tenant-ID": str(TEST_TENANT_ID),
    }
    resp = client.get(
        f"/api/v1/telemetry/metrics?sandbox_id={active_sandbox.id}&time_range=15m",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) > 0
    first_service = data[0]
    assert "service_id" in first_service
    assert len(first_service["points"]) > 0
    pt = first_service["points"][0]
    assert "p50" in pt
    assert "p99" in pt
    assert "rps" in pt


def test_get_metrics_high_cardinality_rejection(client: TestClient, active_sandbox: SandboxRecord, engineer_token: str):
    """Verifies query rejecting high-cardinality label keys."""
    headers = {
        "Authorization": f"Bearer {engineer_token}",
        "X-Tenant-ID": str(TEST_TENANT_ID),
    }
    resp = client.get(
        f"/api/v1/telemetry/metrics?sandbox_id={active_sandbox.id}&service_id=user_id",
        headers=headers,
    )
    assert resp.status_code == 400
    assert "High-cardinality" in resp.json()["detail"]


def test_get_health_success(client: TestClient, active_sandbox: SandboxRecord, viewer_token: str):
    """Verifies real-time service health, pod readiness, and restart inspection."""
    headers = {
        "Authorization": f"Bearer {viewer_token}",
        "X-Tenant-ID": str(TEST_TENANT_ID),
    }
    resp = client.get(
        f"/api/v1/telemetry/health?sandbox_id={active_sandbox.id}",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 5
    first = data[0]
    assert first["status"] in ("healthy", "degraded", "critical")
    assert first["replicas_desired"] >= 1
    assert first["toxiproxy_active"] is True


def test_get_traces_and_waterfall(client: TestClient, active_sandbox: SandboxRecord, engineer_token: str):
    """Verifies OpenTelemetry distributed trace waterfall retrieval."""
    headers = {
        "Authorization": f"Bearer {engineer_token}",
        "X-Tenant-ID": str(TEST_TENANT_ID),
    }
    resp = client.get(
        f"/api/v1/telemetry/traces?sandbox_id={active_sandbox.id}&limit=5",
        headers=headers,
    )
    assert resp.status_code == 200
    traces = resp.json()
    assert len(traces) == 5
    t0 = traces[0]
    assert len(t0["trace_id"]) == 32
    assert len(t0["spans"]) >= 3
    # Check by trace id
    resp_single = client.get(
        f"/api/v1/telemetry/traces/{t0['trace_id']}?sandbox_id={active_sandbox.id}",
        headers=headers,
    )
    assert resp_single.status_code == 200
    assert resp_single.json()["trace_id"] == t0["trace_id"]


def test_get_structured_logs_with_secret_scrubbing(client: TestClient, active_sandbox: SandboxRecord, viewer_token: str):
    """Verifies structured logs retrieval and secret redaction."""
    headers = {
        "Authorization": f"Bearer {viewer_token}",
        "X-Tenant-ID": str(TEST_TENANT_ID),
    }
    resp = client.get(
        f"/api/v1/telemetry/logs?sandbox_id={active_sandbox.id}&limit=10",
        headers=headers,
    )
    assert resp.status_code == 200
    logs = resp.json()
    assert len(logs) > 0
    first_log = logs[0]
    assert "message" in first_log
    assert "trace_id" in first_log
    # Check that secrets in metadata were redacted
    assert first_log["metadata"].get("raw_token") == "[REDACTED_SECRET]"


def test_get_experiment_telemetry_correlation_3_phase(client: TestClient, active_sandbox: SandboxRecord, owner_token: str):
    """Verifies continuous 3-phase experiment correlation endpoint."""
    headers = {
        "Authorization": f"Bearer {owner_token}",
        "X-Tenant-ID": str(TEST_TENANT_ID),
    }
    resp = client.get(
        f"/api/v1/telemetry/experiments/exp-payment-latency-2000?sandbox_id={active_sandbox.id}&target_service=payment-service&magnitude=2000.0",
        headers=headers,
    )
    assert resp.status_code == 200
    corr = resp.json()
    assert corr["experiment_id"] == "exp-payment-latency-2000"
    assert corr["baseline"]["phase"] == "baseline"
    assert corr["fault_active"]["phase"] == "fault_active"
    assert corr["recovery"]["phase"] == "recovery"
    assert corr["impact_delta_p99_pct"] > 500.0
    assert corr["recovered"] is True
    assert len(corr["correlated_traces"]) > 0
    assert len(corr["correlated_logs"]) > 0
