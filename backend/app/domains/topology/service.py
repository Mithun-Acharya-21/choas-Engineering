"""Core Topology Service managing persistence, versioning, optimistic concurrency, and sandbox deployment."""

from datetime import datetime
import logging
from typing import Dict, List, Optional
from uuid import UUID, uuid4
from fastapi import HTTPException, status

from backend.app.domains.sandbox.k8s_builder import K8sManifestBuilder
from backend.app.domains.sandbox.k8s_client import K8sClientWrapper
from backend.app.domains.sandbox.models import (
    AuditLogRecord,
    ContainerStatus,
    K8sPodStatus,
    K8sWorkloadStatus,
    SandboxLifecycleState,
)
from backend.app.domains.sandbox.service import (
    _AUDIT_LOGS,
    _SANDBOX_DB,
    SandboxService,
)
from backend.app.domains.topology.models import (
    NodeType,
    TopologyCreateRequest,
    TopologyDeployResponse,
    TopologyNode,
    TopologyRecord,
    TopologyUpdateRequest,
    TopologyValidationResult,
    TopologyVersionRecord,
)
from backend.app.domains.topology.validator import TopologyValidator

logger = logging.getLogger("chaosengine.topology_service")

# In-memory storage repository simulating PostgreSQL stateful database
_TOPOLOGY_DB: Dict[UUID, TopologyRecord] = {}
_TOPOLOGY_VERSIONS: Dict[UUID, List[TopologyVersionRecord]] = {}


class TopologyService:
    """Manages project microservice topologies, version histories, and sandbox deployment."""

    def __init__(self, k8s_client: Optional[K8sClientWrapper] = None):
        self.k8s = k8s_client or K8sClientWrapper()

    def validate_topology(
        self,
        nodes: List[TopologyNode],
        edges: list,
    ) -> TopologyValidationResult:
        """Runs graph validation without persisting."""
        return TopologyValidator.validate(nodes=nodes, edges=edges)

    def create_topology(
        self,
        request: TopologyCreateRequest,
        tenant_id: UUID,
        user_id: UUID,
    ) -> TopologyRecord:
        """Creates a new project topology record with initial version 1."""
        # 1. Validate Topology Structure
        validation = TopologyValidator.validate(request.nodes, request.edges)
        if not validation.is_valid:
            error_msgs = "; ".join([e.message for e in validation.errors])
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Topology validation failed: {error_msgs}",
            )

        now = datetime.utcnow()
        topology_id = uuid4()

        record = TopologyRecord(
            id=topology_id,
            tenant_id=tenant_id,
            project_id=request.project_id,
            name=request.name,
            description=request.description,
            version=1,
            nodes=request.nodes,
            edges=request.edges,
            groups=request.groups,
            created_at=now,
            updated_at=now,
            created_by=user_id,
        )

        _TOPOLOGY_DB[topology_id] = record

        # 2. Record initial Version 1 snapshot
        version_snapshot = TopologyVersionRecord(
            id=uuid4(),
            topology_id=topology_id,
            version=1,
            name=record.name,
            nodes=record.nodes,
            edges=record.edges,
            groups=record.groups,
            created_at=now,
            created_by=user_id,
        )
        _TOPOLOGY_VERSIONS[topology_id] = [version_snapshot]

        _AUDIT_LOGS.append(
            AuditLogRecord(
                tenant_id=tenant_id,
                user_id=user_id,
                action="TOPOLOGY_CREATED",
                resource_id=topology_id,
                details={"name": record.name, "nodes": len(record.nodes), "version": 1},
            )
        )

        logger.info(f"Created topology {topology_id} (version 1) for project {request.project_id}")
        return record

    def get_topology(self, topology_id: UUID, tenant_id: UUID) -> TopologyRecord:
        """Retrieves topology strictly scoped to authenticated tenant."""
        record = _TOPOLOGY_DB.get(topology_id)
        if not record or record.tenant_id != tenant_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Topology {topology_id} not found",
            )
        return record

    def list_topologies(
        self,
        tenant_id: UUID,
        project_id: Optional[UUID] = None,
    ) -> List[TopologyRecord]:
        """Lists topologies filtered by tenant and optional project."""
        results = []
        for t in _TOPOLOGY_DB.values():
            if t.tenant_id == tenant_id:
                if project_id is None or t.project_id == project_id:
                    results.append(t)
        return sorted(results, key=lambda x: x.updated_at, reverse=True)

    def update_topology(
        self,
        topology_id: UUID,
        request: TopologyUpdateRequest,
        tenant_id: UUID,
        user_id: UUID,
    ) -> TopologyRecord:
        """Updates topology enforcing optimistic concurrency control."""
        record = self.get_topology(topology_id, tenant_id)

        # 1. Optimistic Concurrency Version Check
        if record.version != request.expected_version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Version conflict: current topology version is {record.version}, "
                    f"but update expected version {request.expected_version}. "
                    "Reload the topology before saving."
                ),
            )

        # 2. Validate New Topology Structure
        validation = TopologyValidator.validate(request.nodes, request.edges)
        if not validation.is_valid:
            error_msgs = "; ".join([e.message for e in validation.errors])
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Topology validation failed: {error_msgs}",
            )

        now = datetime.utcnow()
        new_version = record.version + 1

        if request.name:
            record.name = request.name
        if request.description is not None:
            record.description = request.description
        record.nodes = request.nodes
        record.edges = request.edges
        record.groups = request.groups
        record.version = new_version
        record.updated_at = now

        # 3. Save historical version snapshot
        version_snapshot = TopologyVersionRecord(
            id=uuid4(),
            topology_id=topology_id,
            version=new_version,
            name=record.name,
            nodes=record.nodes,
            edges=record.edges,
            groups=record.groups,
            created_at=now,
            created_by=user_id,
        )
        if topology_id not in _TOPOLOGY_VERSIONS:
            _TOPOLOGY_VERSIONS[topology_id] = []
        _TOPOLOGY_VERSIONS[topology_id].append(version_snapshot)

        _AUDIT_LOGS.append(
            AuditLogRecord(
                tenant_id=tenant_id,
                user_id=user_id,
                action="TOPOLOGY_UPDATED",
                resource_id=topology_id,
                details={"version": new_version, "nodes": len(record.nodes)},
            )
        )

        logger.info(f"Updated topology {topology_id} to version {new_version}")
        return record

    def list_versions(self, topology_id: UUID, tenant_id: UUID) -> List[TopologyVersionRecord]:
        """Lists historical snapshots for a topology."""
        self.get_topology(topology_id, tenant_id)  # verifies ownership
        versions = _TOPOLOGY_VERSIONS.get(topology_id, [])
        return sorted(versions, key=lambda x: x.version, reverse=True)

    def revert_to_version(
        self,
        topology_id: UUID,
        target_version: int,
        tenant_id: UUID,
        user_id: UUID,
    ) -> TopologyRecord:
        """Reverts topology state to a historical version snapshot."""
        record = self.get_topology(topology_id, tenant_id)
        versions = _TOPOLOGY_VERSIONS.get(topology_id, [])

        target_snapshot = next((v for v in versions if v.version == target_version), None)
        if not target_snapshot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Version {target_version} not found for topology {topology_id}",
            )

        now = datetime.utcnow()
        new_version = record.version + 1

        record.name = target_snapshot.name
        record.nodes = target_snapshot.nodes
        record.edges = target_snapshot.edges
        record.groups = target_snapshot.groups
        record.version = new_version
        record.updated_at = now

        # Save snapshot representing the revert
        revert_snapshot = TopologyVersionRecord(
            id=uuid4(),
            topology_id=topology_id,
            version=new_version,
            name=f"{record.name} (reverted to v{target_version})",
            nodes=record.nodes,
            edges=record.edges,
            groups=record.groups,
            created_at=now,
            created_by=user_id,
        )
        _TOPOLOGY_VERSIONS[topology_id].append(revert_snapshot)

        _AUDIT_LOGS.append(
            AuditLogRecord(
                tenant_id=tenant_id,
                user_id=user_id,
                action="TOPOLOGY_REVERTED",
                resource_id=topology_id,
                details={"reverted_to": target_version, "new_version": new_version},
            )
        )

        return record

    async def deploy_topology_to_sandbox(
        self,
        sandbox_id: UUID,
        topology_id: UUID,
        tenant_id: UUID,
        user_id: UUID,
    ) -> TopologyDeployResponse:
        """Translates validated topology into approved Kubernetes manifests and deploys into sandbox."""
        # 1. Retrieve Sandbox and Verify State
        sandbox = _SANDBOX_DB.get(sandbox_id)
        if not sandbox or sandbox.tenant_id != tenant_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Sandbox {sandbox_id} not found in active tenant",
            )

        if sandbox.status != SandboxLifecycleState.READY:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Sandbox {sandbox_id} is in status '{sandbox.status}'. Topologies can only be deployed to READY sandboxes.",
            )

        # 2. Retrieve Topology & Validate
        topology = self.get_topology(topology_id, tenant_id)
        validation = TopologyValidator.validate(topology.nodes, topology.edges)
        if not validation.is_valid:
            error_msgs = "; ".join([e.message for e in validation.errors])
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Cannot deploy invalid topology: {error_msgs}",
            )

        ns = sandbox.k8s_namespace
        logger.info(f"Deploying topology '{topology.name}' (v{topology.version}) to sandbox {sandbox_id} in {ns}")

        new_workload_statuses: List[K8sWorkloadStatus] = []

        # 3. Synthesize Kubernetes manifests for each node
        for node in topology.nodes:
            # Skip external mock nodes from cluster deployment
            if node.node_type == NodeType.EXTERNAL:
                continue

            svc_name = node.id
            img = node.image

            # 3a. Create Kubernetes Deployment with injected Toxiproxy sidecar
            dep_manifest = K8sManifestBuilder.build_service_deployment(
                namespace=ns,
                sandbox_id=sandbox.id,
                service_name=svc_name,
                image=img,
                replicas=node.replicas,
            )
            self.k8s.create_deployment(ns, dep_manifest)

            # 3b. Create Kubernetes ClusterIP Service routing to proxy 8080
            svc_manifest = K8sManifestBuilder.build_service_cluster_ip(ns, svc_name)
            self.k8s.create_service(ns, svc_manifest)

            # 3c. Record Workload Status in sandbox record
            new_workload_statuses.append(
                K8sWorkloadStatus(
                    name=svc_name,
                    namespace=ns,
                    replicas_desired=node.replicas,
                    replicas_ready=node.replicas,
                    image=img,
                    container_port=node.container_port,
                    toxiproxy_port=8080,
                    endpoint=f"{svc_name}.{ns}.svc.cluster.local:8080",
                    pods=[
                        K8sPodStatus(
                            name=f"{svc_name}-pod-1",
                            namespace=ns,
                            status="Running",
                            ready_containers=f"2/2",
                            restart_count=0,
                            toxiproxy_active=True,
                            containers=[
                                ContainerStatus(name="app", ready=True, restart_count=0, image=img),
                                ContainerStatus(
                                    name="toxiproxy-sidecar",
                                    ready=True,
                                    restart_count=0,
                                    image="ghcr.io/shopify/toxiproxy:2.9.0",
                                ),
                            ],
                        )
                    ],
                )
            )

        # 4. Update Sandbox Record with Deployed Topology
        sandbox.topology_id = str(topology_id)
        sandbox.workloads = new_workload_statuses
        sandbox.updated_at = datetime.utcnow()

        _AUDIT_LOGS.append(
            AuditLogRecord(
                tenant_id=tenant_id,
                user_id=user_id,
                action="TOPOLOGY_DEPLOYED",
                resource_id=topology_id,
                details={
                    "sandbox_id": str(sandbox_id),
                    "namespace": ns,
                    "version": topology.version,
                    "workloads_deployed": len(new_workload_statuses),
                },
            )
        )

        now = datetime.utcnow()
        return TopologyDeployResponse(
            sandbox_id=sandbox_id,
            topology_id=topology_id,
            topology_version=topology.version,
            status="DEPLOYED",
            workloads_deployed=len(new_workload_statuses),
            namespace=ns,
            message=f"Topology '{topology.name}' (v{topology.version}) successfully deployed to sandbox {sandbox_id}.",
            deployed_at=now,
        )
