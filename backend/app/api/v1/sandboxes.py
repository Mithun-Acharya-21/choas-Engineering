"""FastAPI REST endpoints for dynamic Kubernetes sandbox provisioning and lifecycle management."""

from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Header, HTTPException, Response, status

from backend.app.domains.auth.dependencies import (
    AuthContext,
    require_roles,
    require_sandbox_operator,
    require_sandbox_viewer,
)
from backend.app.domains.sandbox.models import (
    SandboxCreateRequest,
    SandboxLifecycleState,
    SandboxListResponse,
    SandboxRecord,
    SandboxStatusResponse,
    SandboxTerminateResponse,
)
from backend.app.domains.sandbox.reconciler import SandboxReconciler
from backend.app.domains.sandbox.safety import SandboxSafetyViolation
from backend.app.domains.sandbox.service import SandboxService

router = APIRouter(prefix="/sandboxes", tags=["Kubernetes Sandboxes"])
_service = SandboxService()
_reconciler = SandboxReconciler(_service.k8s)


def get_sandbox_service() -> SandboxService:
    return _service


def set_sandbox_service(svc: SandboxService) -> None:
    global _service, _reconciler
    _service = svc
    _reconciler = SandboxReconciler(svc.k8s)


@router.post(
    "",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=SandboxRecord,
    summary="Provision an isolated Kubernetes sandbox",
)
async def provision_sandbox(
    request: SandboxCreateRequest,
    response: Response,
    auth: AuthContext = Depends(require_sandbox_operator),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
) -> SandboxRecord:
    """Asynchronously provisions a tenant-isolated Kubernetes namespace with ResourceQuota,

    LimitRange, default-deny NetworkPolicy, and sample microservices with Toxiproxy sidecars.
    """
    try:
        record = await _service.create_sandbox(
            request=request,
            tenant_id=auth.tenant_id,
            tenant_slug=auth.tenant_slug,
            user_id=auth.user_id,
            idempotency_key=idempotency_key,
        )
        response.headers["Location"] = f"/api/v1/sandboxes/{record.id}"
        return record
    except SandboxSafetyViolation as ex:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ex))
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sandbox provisioning initiation failed: {ex}",
        )


@router.get(
    "",
    response_model=SandboxListResponse,
    summary="List sandboxes scoped to authenticated tenant and project",
)
async def list_sandboxes(
    project_id: Optional[UUID] = None,
    auth: AuthContext = Depends(require_sandbox_viewer),
) -> SandboxListResponse:
    """Returns sandboxes strictly filtered by the authenticated caller's tenant boundary and optional project."""
    items = _service.list_sandboxes(tenant_id=auth.tenant_id, project_id=project_id)
    return SandboxListResponse(items=items, total=len(items))


@router.get(
    "/{sandbox_id}",
    response_model=SandboxRecord,
    summary="Retrieve sandbox details and topology state",
)
async def get_sandbox(
    sandbox_id: UUID,
    auth: AuthContext = Depends(require_sandbox_viewer),
) -> SandboxRecord:
    """Retrieves full sandbox entity including workloads, pods, containers, and quotas."""
    try:
        return _service.get_sandbox(sandbox_id=sandbox_id, tenant_id=auth.tenant_id)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sandbox with ID '{sandbox_id}' was not found in active tenant.",
        )


@router.get(
    "/{sandbox_id}/status",
    response_model=SandboxStatusResponse,
    summary="Get real-time provisioning progress and workload health (polling)",
)
async def get_sandbox_status(
    sandbox_id: UUID,
    auth: AuthContext = Depends(require_sandbox_viewer),
) -> SandboxStatusResponse:
    """Lightweight polling endpoint returning state percentage, current step, and workload readiness count."""
    try:
        return _service.get_sandbox_status(sandbox_id=sandbox_id, tenant_id=auth.tenant_id)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sandbox with ID '{sandbox_id}' was not found in active tenant.",
        )


@router.delete(
    "/{sandbox_id}",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=SandboxTerminateResponse,
    summary="Terminate sandbox and delete Kubernetes namespace",
)
async def terminate_sandbox(
    sandbox_id: UUID,
    auth: AuthContext = Depends(require_sandbox_operator),
) -> SandboxTerminateResponse:
    """Asynchronously triggers graceful teardown of Kubernetes namespace and associated resources."""
    try:
        return await _service.terminate_sandbox(
            sandbox_id=sandbox_id,
            tenant_id=auth.tenant_id,
            user_id=auth.user_id,
        )
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sandbox with ID '{sandbox_id}' was not found in active tenant.",
        )
    except SandboxSafetyViolation as ex:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ex))
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Teardown failed: {ex}",
        )


@router.post(
    "/reconcile",
    summary="Trigger watchdog reconciliation pass",
)
async def trigger_reconciliation(
    auth: AuthContext = Depends(require_roles(["TenantOwner"])),
):
    """Admin-only endpoint to reconcile live Kubernetes namespaces against database records."""
    return await _reconciler.run_reconciliation()
