"""FastAPI REST endpoints for microservice topology editor, versioning, and sandbox deployment."""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from pydantic import BaseModel

from backend.app.domains.auth.dependencies import (
    AuthContext,
    require_roles,
    require_sandbox_operator,
    require_sandbox_viewer,
)
from backend.app.domains.topology.models import (
    TopologyCreateRequest,
    TopologyDeployRequest,
    TopologyDeployResponse,
    TopologyEdge,
    TopologyNode,
    TopologyRecord,
    TopologyUpdateRequest,
    TopologyValidationResult,
    TopologyVersionRecord,
)
from backend.app.domains.topology.service import TopologyService

router = APIRouter(prefix="/topologies", tags=["Microservice Topologies"])
_topology_service = TopologyService()


def get_topology_service() -> TopologyService:
    return _topology_service


def set_topology_service(svc: TopologyService) -> None:
    global _topology_service
    _topology_service = svc


class ValidatePayload(BaseModel):
    nodes: List[TopologyNode]
    edges: List[TopologyEdge]


class RevertPayload(BaseModel):
    target_version: int


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=TopologyRecord,
    summary="Create a new microservice topology",
)
async def create_topology(
    request: TopologyCreateRequest,
    auth: AuthContext = Depends(require_sandbox_operator),
):
    svc = get_topology_service()
    return svc.create_topology(
        request=request,
        tenant_id=auth.tenant_id,
        user_id=auth.user_id,
    )


@router.get(
    "",
    response_model=List[TopologyRecord],
    summary="List microservice topologies scoped to tenant and project",
)
async def list_topologies(
    project_id: Optional[UUID] = Query(None, description="Filter by project ID"),
    auth: AuthContext = Depends(require_sandbox_viewer),
):
    svc = get_topology_service()
    return svc.list_topologies(tenant_id=auth.tenant_id, project_id=project_id)


@router.get(
    "/{topology_id}",
    response_model=TopologyRecord,
    summary="Retrieve topology details and graph structure",
)
async def get_topology(
    topology_id: UUID,
    auth: AuthContext = Depends(require_sandbox_viewer),
):
    svc = get_topology_service()
    return svc.get_topology(topology_id=topology_id, tenant_id=auth.tenant_id)


@router.put(
    "/{topology_id}",
    response_model=TopologyRecord,
    summary="Update topology with optimistic concurrency check",
)
async def update_topology(
    topology_id: UUID,
    request: TopologyUpdateRequest,
    auth: AuthContext = Depends(require_sandbox_operator),
):
    svc = get_topology_service()
    return svc.update_topology(
        topology_id=topology_id,
        request=request,
        tenant_id=auth.tenant_id,
        user_id=auth.user_id,
    )


@router.post(
    "/validate",
    response_model=TopologyValidationResult,
    summary="Validate directed topology graph without saving",
)
async def validate_topology_graph(
    payload: ValidatePayload,
    auth: AuthContext = Depends(require_sandbox_viewer),
):
    svc = get_topology_service()
    return svc.validate_topology(nodes=payload.nodes, edges=payload.edges)


@router.get(
    "/{topology_id}/versions",
    response_model=List[TopologyVersionRecord],
    summary="Retrieve version history for a topology",
)
async def get_topology_versions(
    topology_id: UUID,
    auth: AuthContext = Depends(require_sandbox_viewer),
):
    svc = get_topology_service()
    return svc.list_versions(topology_id=topology_id, tenant_id=auth.tenant_id)


@router.post(
    "/{topology_id}/revert",
    response_model=TopologyRecord,
    summary="Revert topology to a previous version snapshot",
)
async def revert_topology_version(
    topology_id: UUID,
    payload: RevertPayload,
    auth: AuthContext = Depends(require_sandbox_operator),
):
    svc = get_topology_service()
    return svc.revert_to_version(
        topology_id=topology_id,
        target_version=payload.target_version,
        tenant_id=auth.tenant_id,
        user_id=auth.user_id,
    )


@router.post(
    "/{topology_id}/deploy",
    response_model=TopologyDeployResponse,
    summary="Deploy validated topology to an active M3 Kubernetes sandbox",
)
async def deploy_topology(
    topology_id: UUID,
    payload: TopologyDeployRequest,
    auth: AuthContext = Depends(require_sandbox_operator),
):
    svc = get_topology_service()
    return await svc.deploy_topology_to_sandbox(
        sandbox_id=payload.sandbox_id,
        topology_id=topology_id,
        tenant_id=auth.tenant_id,
        user_id=auth.user_id,
    )
