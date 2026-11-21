"""Unit tests for TopologyService business logic, versioning, concurrency, and deployment."""

import asyncio
from datetime import datetime, timedelta
from uuid import UUID, uuid4
import pytest
from fastapi import HTTPException

from backend.app.domains.sandbox.models import (
    ResourceProfile,
    SandboxCreateRequest,
    SandboxLifecycleState,
    SandboxRecord,
)
from backend.app.domains.sandbox.service import (
    _SANDBOX_DB,
    SandboxService,
)
from backend.app.domains.topology.models import (
    NodeType,
    ProtocolType,
    TopologyCreateRequest,
    TopologyEdge,
    TopologyNode,
    TopologyUpdateRequest,
)
from backend.app.domains.topology.service import (
    _TOPOLOGY_DB,
    _TOPOLOGY_VERSIONS,
    TopologyService,
)


@pytest.fixture(autouse=True)
def clean_topology_state():
    _TOPOLOGY_DB.clear()
    _TOPOLOGY_VERSIONS.clear()
    yield
    _TOPOLOGY_DB.clear()
    _TOPOLOGY_VERSIONS.clear()


def sample_nodes():
    return [
        TopologyNode(
            id="api-gateway",
            name="API Gateway",
            node_type=NodeType.API_GATEWAY,
            image="chaosengine/api-gateway:1.0.0",
            container_port=8081,
        ),
        TopologyNode(
            id="order-service",
            name="Order Service",
            node_type=NodeType.APP_SERVICE,
            image="chaosengine/order-service:1.0.0",
            container_port=8081,
        ),
    ]


def sample_edges():
    return [
        TopologyEdge(id="e1", source="api-gateway", target="order-service", protocol=ProtocolType.HTTP)
    ]


def test_create_topology_and_version_snapshot(mock_k8s):
    svc = TopologyService(k8s_client=mock_k8s)
    tenant_id = uuid4()
    project_id = uuid4()
    user_id = uuid4()

    req = TopologyCreateRequest(
        name="E-Commerce Baseline",
        project_id=project_id,
        description="Core checkout topology",
        nodes=sample_nodes(),
        edges=sample_edges(),
    )

    record = svc.create_topology(req, tenant_id, user_id)
    assert record.name == "E-Commerce Baseline"
    assert record.version == 1
    assert len(record.nodes) == 2
    assert len(record.edges) == 1

    # Check version history
    versions = svc.list_versions(record.id, tenant_id)
    assert len(versions) == 1
    assert versions[0].version == 1


def test_optimistic_concurrency_conflict(mock_k8s):
    svc = TopologyService(k8s_client=mock_k8s)
    tenant_id = uuid4()
    project_id = uuid4()
    user_id = uuid4()

    record = svc.create_topology(
        TopologyCreateRequest(name="Concurrent Topology", project_id=project_id, nodes=sample_nodes(), edges=sample_edges()),
        tenant_id,
        user_id,
    )
    assert record.version == 1

    # Engineer A updates with expected_version=1 -> succeeds, version becomes 2
    update_req_a = TopologyUpdateRequest(
        name="Updated by A",
        expected_version=1,
        nodes=sample_nodes(),
        edges=sample_edges(),
    )
    updated = svc.update_topology(record.id, update_req_a, tenant_id, user_id)
    assert updated.version == 2

    # Engineer B attempts update with stale expected_version=1 -> raises 409 Conflict
    update_req_b = TopologyUpdateRequest(
        name="Stale update by B",
        expected_version=1,
        nodes=sample_nodes(),
        edges=sample_edges(),
    )
    with pytest.raises(HTTPException) as exc_info:
        svc.update_topology(record.id, update_req_b, tenant_id, user_id)
    assert exc_info.value.status_code == 409
    assert "Version conflict" in exc_info.value.detail


def test_revert_to_historical_version(mock_k8s):
    svc = TopologyService(k8s_client=mock_k8s)
    tenant_id = uuid4()
    project_id = uuid4()
    user_id = uuid4()

    # Initial version 1 with 2 nodes
    record = svc.create_topology(
        TopologyCreateRequest(name="Original v1", project_id=project_id, nodes=sample_nodes(), edges=sample_edges()),
        tenant_id,
        user_id,
    )

    # Version 2 with 3 nodes
    extended_nodes = sample_nodes() + [
        TopologyNode(id="payment-service", name="Payment Service", image="chaosengine/payment-service:1.0.0")
    ]
    extended_edges = sample_edges() + [
        TopologyEdge(id="e2", source="order-service", target="payment-service")
    ]
    svc.update_topology(
        record.id,
        TopologyUpdateRequest(name="Extended v2", expected_version=1, nodes=extended_nodes, edges=extended_edges),
        tenant_id,
        user_id,
    )

    current = svc.get_topology(record.id, tenant_id)
    assert current.version == 2
    assert len(current.nodes) == 3

    # Revert back to Version 1 snapshot
    reverted = svc.revert_to_version(record.id, target_version=1, tenant_id=tenant_id, user_id=user_id)
    assert reverted.version == 3  # new version created with v1 state
    assert len(reverted.nodes) == 2
    assert reverted.name == "Original v1"


def test_tenant_isolation(mock_k8s):
    svc = TopologyService(k8s_client=mock_k8s)
    tenant_a = uuid4()
    tenant_b = uuid4()
    user_id = uuid4()

    record_a = svc.create_topology(
        TopologyCreateRequest(name="Tenant A Secret Topology", project_id=uuid4(), nodes=sample_nodes(), edges=sample_edges()),
        tenant_a,
        user_id,
    )

    # Tenant B cannot retrieve Tenant A's topology
    with pytest.raises(HTTPException) as exc:
        svc.get_topology(record_a.id, tenant_b)
    assert exc.value.status_code == 404

    # Tenant B cannot list Tenant A's topologies
    list_b = svc.list_topologies(tenant_b)
    assert len(list_b) == 0


def test_deploy_topology_to_sandbox_manifest_synthesis(mock_k8s):
    async def _test():
        svc = TopologyService(k8s_client=mock_k8s)
        tenant_id = uuid4()
        project_id = uuid4()
        user_id = uuid4()

        # 1. Create a Topology
        top_record = svc.create_topology(
            TopologyCreateRequest(
                name="Deployable Topology",
                project_id=project_id,
                nodes=sample_nodes(),
                edges=sample_edges(),
            ),
            tenant_id,
            user_id,
        )

        # 2. Create a READY Sandbox
        sandbox_id = uuid4()
        sandbox = SandboxRecord(
            id=sandbox_id,
            tenant_id=tenant_id,
            project_id=project_id,
            name="Deployment Test Sandbox",
            k8s_namespace="sandbox-acme-deploy01",
            cluster_id="cluster-1",
            status=SandboxLifecycleState.READY,
            resource_profile=ResourceProfile(cpu_request="2", cpu_limit="4"),
            is_isolated=True,
            expires_at=datetime.utcnow() + timedelta(hours=4),
        )
        _SANDBOX_DB[sandbox_id] = sandbox

        # 3. Deploy Topology into Sandbox
        deploy_res = await svc.deploy_topology_to_sandbox(
            sandbox_id=sandbox_id,
            topology_id=top_record.id,
            tenant_id=tenant_id,
            user_id=user_id,
        )

        assert deploy_res.status == "DEPLOYED"
        assert deploy_res.workloads_deployed == 2
        assert deploy_res.namespace == "sandbox-acme-deploy01"

        # Verify Kubernetes mock received Deployments and Services
        assert "sandbox-acme-deploy01/api-gateway" in mock_k8s.deployments
        assert "sandbox-acme-deploy01/order-service" in mock_k8s.deployments
        assert "sandbox-acme-deploy01/api-gateway" in mock_k8s.services
        assert "sandbox-acme-deploy01/order-service" in mock_k8s.services

        # Verify Toxiproxy sidecar was injected in Deployment
        dep_manifest = mock_k8s.deployments["sandbox-acme-deploy01/api-gateway"]
        containers = dep_manifest["spec"]["template"]["spec"]["containers"]
        assert len(containers) == 2
        assert containers[0]["name"] == "app"
        assert containers[1]["name"] == "toxiproxy-sidecar"
        assert containers[1]["image"] == "ghcr.io/shopify/toxiproxy:2.9.0"

        # Verify Sandbox record was updated with new workloads
        updated_sandbox = _SANDBOX_DB[sandbox_id]
        assert len(updated_sandbox.workloads) == 2
        assert updated_sandbox.topology_id == str(top_record.id)

    asyncio.run(_test())
