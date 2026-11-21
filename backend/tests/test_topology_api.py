"""Integration tests for Topology REST API endpoints and RBAC enforcement."""

from datetime import datetime, timedelta
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient

from backend.app.api.v1.topologies import set_topology_service
from backend.app.domains.sandbox.models import ResourceProfile, SandboxLifecycleState, SandboxRecord
from backend.app.domains.sandbox.service import _SANDBOX_DB
from backend.app.domains.topology.models import NodeType, ProtocolType
from backend.app.domains.topology.service import (
    _TOPOLOGY_DB,
    _TOPOLOGY_VERSIONS,
    TopologyService,
)


@pytest.fixture(autouse=True)
def setup_topology_api(mock_k8s):
    _TOPOLOGY_DB.clear()
    _TOPOLOGY_VERSIONS.clear()
    svc = TopologyService(k8s_client=mock_k8s)
    set_topology_service(svc)
    yield
    _TOPOLOGY_DB.clear()
    _TOPOLOGY_VERSIONS.clear()


def sample_payload(project_id: str):
    return {
        "name": "Checkout API Graph",
        "project_id": project_id,
        "description": "Integration test graph",
        "nodes": [
            {
                "id": "api-gateway",
                "name": "API Gateway",
                "node_type": "api_gateway",
                "image": "chaosengine/api-gateway:1.0.0",
                "container_port": 8081,
            },
            {
                "id": "order-service",
                "name": "Order Service",
                "node_type": "app_service",
                "image": "chaosengine/order-service:1.0.0",
                "container_port": 8081,
            },
        ],
        "edges": [
            {"id": "e1", "source": "api-gateway", "target": "order-service", "protocol": "HTTP"}
        ],
        "groups": [],
    }


def test_viewer_cannot_create_or_modify_topology(client: TestClient, viewer_token: str):
    payload = sample_payload(str(uuid4()))

    # Viewer POST /topologies -> 403 Forbidden
    res_post = client.post(
        "/api/v1/topologies",
        json=payload,
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert res_post.status_code == 403
    assert "Access Denied" in res_post.json()["detail"]


def test_viewer_can_list_and_validate_topology(client: TestClient, viewer_token: str, engineer_token: str):
    project_id = str(uuid4())
    payload = sample_payload(project_id)

    # Engineer creates topology first
    res_create = client.post(
        "/api/v1/topologies",
        json=payload,
        headers={"Authorization": f"Bearer {engineer_token}"},
    )
    assert res_create.status_code == 201
    top_id = res_create.json()["id"]

    # Viewer can list topologies
    res_list = client.get(
        f"/api/v1/topologies?project_id={project_id}",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert res_list.status_code == 200
    items = res_list.json()
    assert len(items) == 1
    assert items[0]["id"] == top_id

    # Viewer can validate an ad-hoc topology graph
    res_val = client.post(
        "/api/v1/topologies/validate",
        json={"nodes": payload["nodes"], "edges": payload["edges"]},
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert res_val.status_code == 200
    assert res_val.json()["is_valid"] is True


def test_engineer_full_topology_lifecycle_and_deploy(
    client: TestClient,
    engineer_token: str,
    mock_k8s,
):
    project_id = str(uuid4())
    payload = sample_payload(project_id)

    # 1. Create Topology
    res_create = client.post(
        "/api/v1/topologies",
        json=payload,
        headers={"Authorization": f"Bearer {engineer_token}"},
    )
    assert res_create.status_code == 201
    top = res_create.json()
    top_id = top["id"]
    assert top["version"] == 1

    # 2. Update Topology
    update_payload = {
        "name": "Checkout API Graph v2",
        "expected_version": 1,
        "nodes": payload["nodes"],
        "edges": payload["edges"],
        "groups": [],
    }
    res_update = client.put(
        f"/api/v1/topologies/{top_id}",
        json=update_payload,
        headers={"Authorization": f"Bearer {engineer_token}"},
    )
    assert res_update.status_code == 200
    assert res_update.json()["version"] == 2
    assert res_update.json()["name"] == "Checkout API Graph v2"

    # 3. Check Version History
    res_versions = client.get(
        f"/api/v1/topologies/{top_id}/versions",
        headers={"Authorization": f"Bearer {engineer_token}"},
    )
    assert res_versions.status_code == 200
    versions = res_versions.json()
    assert len(versions) == 2

    # 4. Deploy into an active Sandbox
    # Setup Sandbox in DB under the same tenant as engineer_token
    tenant_id = res_create.json()["tenant_id"]
    sandbox_id = uuid4()
    _SANDBOX_DB[sandbox_id] = SandboxRecord(
        id=sandbox_id,
        tenant_id=tenant_id,
        project_id=project_id,
        name="Integration Sandbox",
        k8s_namespace="sandbox-test-deploy-01",
        cluster_id="cluster-1",
        resource_profile=ResourceProfile(cpu_request="2", cpu_limit="4"),
        status=SandboxLifecycleState.READY,
        is_isolated=True,
        expires_at=datetime.utcnow() + timedelta(hours=4),
    )

    res_deploy = client.post(
        f"/api/v1/topologies/{top_id}/deploy",
        json={"sandbox_id": str(sandbox_id)},
        headers={"Authorization": f"Bearer {engineer_token}"},
    )
    assert res_deploy.status_code == 200
    deploy_data = res_deploy.json()
    assert deploy_data["status"] == "DEPLOYED"
    assert deploy_data["workloads_deployed"] == 2
