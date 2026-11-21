"""FastAPI REST Router for AI-Assisted RCA Explanations and Incident Postmortems (Milestone M9)."""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Response, status

from backend.app.domains.auth.dependencies import (
    AuthContext,
    require_roles,
    require_sandbox_operator,
    require_sandbox_viewer,
)
from backend.app.domains.postmortem.models import (
    ActionItemUpdateRequest,
    AIIncidentExplanation,
    GenerateExplanationRequest,
    GeneratePostmortemRequest,
    IncidentPostmortem,
    LifecycleTransitionRequest,
    PostmortemStatus,
    SingleActionItemUpdate,
)
from backend.app.domains.postmortem.service import postmortem_service

router = APIRouter(tags=["AI Explanations & Incident Postmortems (M9)"])

# RBAC permission for approving/publishing postmortems
require_tenant_owner = require_roles(["TenantOwner"])


@router.post(
    "/incidents/{id}/explanation",
    response_model=AIIncidentExplanation,
    summary="Generate or retrieve evidence-grounded AI explanation for an incident",
)
async def generate_incident_explanation(
    id: UUID,
    req: Optional[GenerateExplanationRequest] = None,
    auth: AuthContext = Depends(require_sandbox_viewer),
):
    """Generates an evidence-grounded incident explanation from deterministic M8 RCA analysis."""
    try:
        force = req.force_refresh if req else False
        provider = req.provider if req else None
        model_name = req.model_name if req else None

        return postmortem_service.get_or_generate_explanation(
            incident_id=id,
            tenant_id=auth.tenant_id,
            force_refresh=force,
            provider=provider,
            model_name=model_name,
        )
    except KeyError as k_err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(k_err))
    except Exception as ex:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(ex))


@router.post(
    "/incidents/{id}/postmortem",
    response_model=IncidentPostmortem,
    summary="Generate a comprehensive incident postmortem report",
)
async def generate_incident_postmortem(
    id: UUID,
    req: Optional[GeneratePostmortemRequest] = None,
    auth: AuthContext = Depends(require_sandbox_operator),
):
    """Synthesizes a full incident postmortem report with action items and timeline."""
    try:
        title = req.title if req else None
        force = req.force_refresh if req else False

        return postmortem_service.generate_postmortem(
            incident_id=id,
            tenant_id=auth.tenant_id,
            title=title,
            force_refresh=force,
            author_email=auth.email,
        )
    except KeyError as k_err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(k_err))
    except Exception as ex:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(ex))


@router.get(
    "/incidents/{id}/postmortem",
    response_model=Optional[IncidentPostmortem],
    summary="Get latest postmortem for an incident",
)
async def get_incident_postmortem(
    id: UUID,
    auth: AuthContext = Depends(require_sandbox_viewer),
):
    """Retrieves the latest incident postmortem for the specified incident ID."""
    pm = postmortem_service.get_postmortem_by_incident(incident_id=id, tenant_id=auth.tenant_id)
    if not pm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No postmortem report found for incident {id}.",
        )
    return pm


@router.get(
    "/postmortems/{id}",
    response_model=IncidentPostmortem,
    summary="Get postmortem report by ID",
)
async def get_postmortem_by_id(
    id: UUID,
    auth: AuthContext = Depends(require_sandbox_viewer),
):
    """Retrieves an incident postmortem by its unique report ID."""
    pm = postmortem_service.get_postmortem_by_id(postmortem_id=id, tenant_id=auth.tenant_id)
    if not pm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Postmortem with ID {id} not found.",
        )
    return pm


@router.get(
    "/postmortems/{id}/pdf",
    summary="Export postmortem report as vector PDF",
    responses={
        200: {
            "content": {"application/pdf": {}},
            "description": "Generated PDF binary stream.",
        }
    },
)
async def export_postmortem_pdf(
    id: UUID,
    auth: AuthContext = Depends(require_sandbox_viewer),
):
    """Generates and streams a vector PDF of the incident postmortem report."""
    try:
        pdf_bytes = postmortem_service.export_pdf(postmortem_id=id, tenant_id=auth.tenant_id)
        filename = f"postmortem-{str(id)[:8]}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except KeyError as k_err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(k_err))
    except Exception as ex:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(ex))


@router.patch(
    "/postmortems/{id}/action-items",
    response_model=IncidentPostmortem,
    summary="Update all action items on a postmortem report",
)
async def update_postmortem_action_items(
    id: UUID,
    req: ActionItemUpdateRequest,
    auth: AuthContext = Depends(require_sandbox_operator),
):
    """Allows Engineers and Owners to update action items on a postmortem."""
    try:
        return postmortem_service.update_action_items(
            postmortem_id=id, tenant_id=auth.tenant_id, new_items=req.action_items
        )
    except KeyError as k_err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(k_err))


@router.patch(
    "/postmortems/{id}/action-items/{item_id}",
    response_model=IncidentPostmortem,
    summary="Update a specific action item on a postmortem report",
)
async def update_single_action_item(
    id: UUID,
    item_id: str,
    req: SingleActionItemUpdate,
    auth: AuthContext = Depends(require_sandbox_operator),
):
    """Allows Engineers and Owners to update a single action item on a postmortem."""
    try:
        return postmortem_service.update_single_action_item(
            postmortem_id=id,
            tenant_id=auth.tenant_id,
            action_item_id=item_id,
            title=req.title,
            description=req.description,
            priority=req.priority,
            status=req.status,
            assigned_to=req.assigned_to,
            due_date=req.due_date,
        )
    except KeyError as k_err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(k_err))


@router.post(
    "/postmortems/{id}/transition",
    response_model=IncidentPostmortem,
    summary="Transition postmortem lifecycle status",
)
async def transition_postmortem_lifecycle(
    id: UUID,
    req: LifecycleTransitionRequest,
    auth: AuthContext = Depends(require_sandbox_operator),
):
    """
    Transitions postmortem lifecycle state (DRAFT -> IN_REVIEW -> APPROVED -> PUBLISHED).
    Approval and publication require TenantOwner role.
    """
    try:
        is_owner = auth.role == "TenantOwner"
        return postmortem_service.transition_status(
            postmortem_id=id,
            tenant_id=auth.tenant_id,
            target_status=req.target_status,
            user_email=auth.email,
            is_owner=is_owner,
        )
    except PermissionError as p_err:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(p_err))
    except KeyError as k_err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(k_err))


@router.post(
    "/postmortems/{id}/approve",
    response_model=IncidentPostmortem,
    summary="Approve postmortem report (TenantOwner only)",
)
async def approve_postmortem(
    id: UUID,
    auth: AuthContext = Depends(require_tenant_owner),
):
    """Approves an incident postmortem for organizational distribution. Requires TenantOwner role."""
    try:
        return postmortem_service.transition_status(
            postmortem_id=id,
            tenant_id=auth.tenant_id,
            target_status=PostmortemStatus.APPROVED,
            user_email=auth.email,
            is_owner=True,
        )
    except KeyError as k_err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(k_err))


@router.post(
    "/postmortems/{id}/publish",
    response_model=IncidentPostmortem,
    summary="Publish postmortem report (TenantOwner only)",
)
async def publish_postmortem(
    id: UUID,
    auth: AuthContext = Depends(require_tenant_owner),
):
    """Publishes an approved postmortem to the company knowledge base. Requires TenantOwner role."""
    try:
        return postmortem_service.transition_status(
            postmortem_id=id,
            tenant_id=auth.tenant_id,
            target_status=PostmortemStatus.PUBLISHED,
            user_email=auth.email,
            is_owner=True,
        )
    except KeyError as k_err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(k_err))
