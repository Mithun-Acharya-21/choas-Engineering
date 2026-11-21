"""Integration tests for Sandbox REST API endpoints."""

from uuid import uuid4
import pytest
from fastapi.testclient import TestClient

from backend.app.domains.sandbox.models import SandboxLifecycleState


def test_viewer_cannot_provision_sandbox(client: TestClient, viewer_token: str):
    payload = {
        "name": "Unauthorized Sandbox",
        "project_id": str(uuid4()),
    }
    response = client.post(
        "/api/v1/sandboxes",
        json=payload,
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert response.status_code == 403
    assert "Access Denied" in response.json()["detail"]


def test_engineer_can_provision_sandbox(client: TestClient, engineer_token: str):
    project_id = str(uuid4())
    payload = {
        "name": "Engineer Test Sandbox",
        "project_id": project_id,
        "resource_profile": {
            "profile_name": "standard",
            "cpu_request": "2",
            "cpu_limit": "4",
            "memory_request": "4Gi",
            "memory_limit": "8Gi",
            "max_pods": 20,
        },
    }
    response = client.post(
        "/api/v1/sandboxes",
        json=payload,
        headers={
            "Authorization": f"Bearer {engineer_token}",
            "Idempotency-Key": "eng-idem-001",
        },
    )
    assert response.status_code == 202
    data = response.json()
    assert data["name"] == "Engineer Test Sandbox"
    assert "Location" in response.headers
    sandbox_id = data["id"]

    # Retrieve details
    get_res = client.get(
        f"/api/v1/sandboxes/{sandbox_id}",
        headers={"Authorization": f"Bearer {engineer_token}"},
    )
    assert get_res.status_code == 200

    # Retrieve status polling endpoint
    status_res = client.get(
        f"/api/v1/sandboxes/{sandbox_id}/status",
        headers={"Authorization": f"Bearer {engineer_token}"},
    )
    assert status_res.status_code == 200
    assert "progress_percentage" in status_res.json()


def test_idempotency_key_prevents_duplicate_provisioning(client: TestClient, owner_token: str):
    project_id = str(uuid4())
    payload = {"name": "Idem Sandbox", "project_id": project_id}
    headers = {
        "Authorization": f"Bearer {owner_token}",
        "Idempotency-Key": "unique-idem-token-abc",
    }

    res1 = client.post("/api/v1/sandboxes", json=payload, headers=headers)
    assert res1.status_code == 202
    id1 = res1.json()["id"]

    res2 = client.post("/api/v1/sandboxes", json=payload, headers=headers)
    assert res2.status_code == 202
    id2 = res2.json()["id"]

    assert id1 == id2


def test_cross_tenant_isolation(
    client: TestClient,
    owner_token: str,
    other_tenant_token: str,
):
    # Provision under Tenant A
    payload = {"name": "Tenant A Private Sandbox", "project_id": str(uuid4())}
    res = client.post(
        "/api/v1/sandboxes",
        json=payload,
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    sandbox_id = res.json()["id"]

    # Attempt to access using Tenant B token
    get_res = client.get(
        f"/api/v1/sandboxes/{sandbox_id}",
        headers={"Authorization": f"Bearer {other_tenant_token}"},
    )
    assert get_res.status_code == 404

    # Attempt to terminate using Tenant B token
    del_res = client.delete(
        f"/api/v1/sandboxes/{sandbox_id}",
        headers={"Authorization": f"Bearer {other_tenant_token}"},
    )
    assert del_res.status_code == 404


def test_viewer_can_list_and_view_sandboxes_but_not_terminate(
    client: TestClient,
    owner_token: str,
    viewer_token: str,
):
    project_id = str(uuid4())
    payload = {"name": "Shared Lab", "project_id": project_id}
    res = client.post(
        "/api/v1/sandboxes",
        json=payload,
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    sandbox_id = res.json()["id"]

    # Viewer lists sandboxes
    list_res = client.get(
        f"/api/v1/sandboxes?project_id={project_id}",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    assert len(items) >= 1
    assert any(i["id"] == sandbox_id for i in items)

    # Viewer cannot delete sandbox
    del_res = client.delete(
        f"/api/v1/sandboxes/{sandbox_id}",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert del_res.status_code == 403
