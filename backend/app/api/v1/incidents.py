"""FastAPI REST router for Automated Incident Detection, Lifecycle & SLO Triage (Milestone M7)."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.app.domains.auth.dependencies import (
    AuthContext,
    require_sandbox_operator,
    require_sandbox_viewer,
)
from backend.app.domains.incident.models import (
    IncidentEvaluationResponse,
    IncidentEvidencePackage,
    IncidentLifecycleEvent,
    IncidentListResponse,
    IncidentRecord,
    IncidentSeverity,
    IncidentStatus,
    IncidentTransitionRequest,
)
from backend.app.domains.incident.service import (
    incident_service,
)
from backend.app.domains.sandbox.service import SandboxService

router = APIRouter(prefix="/incidents", tags=["Incidents & SLO Violations"])
_sandbox_svc = SandboxService()


def _verify_sandbox_access(sandbox_id: UUID, auth: AuthContext):
    """Verifies that the target sandbox belongs to the active tenant."""
    try:
        return _sandbox_svc.get_sandbox(sandbox_id, auth.tenant_id)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sandbox '{sandbox_id}' not found in active tenant.",
        )


@router.get(
    "",
    response_model=IncidentListResponse,
    summary="List incidents with severity, status, and service filters",
)
async def list_incidents(
    sandbox_id: Optional[UUID] = Query(None, description="Filter by sandbox ID"),
    status: Optional[IncidentStatus] = Query(None, description="Filter by incident lifecycle status"),
    severity: Optional[IncidentSeverity] = Query(None, description="Filter by severity"),
    service: Optional[str] = Query(None, description="Filter by affected microservice"),
    limit: int = Query(50, ge=1, le=200, description="Max incidents to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    auth: AuthContext = Depends(require_sandbox_viewer),
):
    """Retrieves tenant-scoped incident records matching filters."""
    items, total = incident_service.list_incidents(
        tenant_id=auth.tenant_id,
        sandbox_id=sandbox_id,
        status=status,
        severity=severity,
        service=service,
        limit=limit,
        offset=offset,
    )
    return IncidentListResponse(items=items, total=total)


@router.get(
    "/{id}",
    response_model=IncidentRecord,
    summary="Retrieve detailed incident record and evidence summary",
)
async def get_incident(
    id: UUID,
    auth: AuthContext = Depends(require_sandbox_viewer),
):
    """Retrieves a single incident by ID verifying tenant ownership."""
    try:
        return incident_service.get_incident(id, auth.tenant_id)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{id}' not found in active tenant.",
        )


@router.get(
    "/{id}/timeline",
    response_model=List[IncidentLifecycleEvent],
    summary="Retrieve immutable lifecycle state transition timeline",
)
async def get_incident_timeline(
    id: UUID,
    auth: AuthContext = Depends(require_sandbox_viewer),
):
    """Retrieves the immutable audit event history of lifecycle transitions."""
    try:
        return incident_service.get_incident_timeline(id, auth.tenant_id)
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{id}' not found in active tenant.",
        )


@router.get(
    "/{id}/evidence",
    response_model=IncidentEvidencePackage,
    summary="Retrieve structured evidence package for downstream RCA",
)
async def get_incident_evidence(
    id: UUID,
    auth: AuthContext = Depends(require_sandbox_viewer),
):
    """Retrieves the bounded evidence package including metric snapshots, trace references, and topology paths."""
    try:
        inc = incident_service.get_incident(id, auth.tenant_id)
        return inc.evidence_package
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident '{id}' not found in active tenant.",
        )


@router.post(
    "/{id}/acknowledge",
    response_model=IncidentRecord,
    summary="Acknowledge an incident (transition OPEN -> ACKNOWLEDGED)",
)
async def acknowledge_incident(
    id: UUID,
    req: Optional[IncidentTransitionRequest] = None,
    auth: AuthContext = Depends(require_sandbox_operator),
):
    """Acknowledges an active incident, assigning it to the operator."""
    try:
        return incident_service.transition_incident(
            incident_id=id,
            tenant_id=auth.tenant_id,
            target_status=IncidentStatus.ACKNOWLEDGED,
            user_id=str(auth.user_id),
            note=req.note if req else "Acknowledged by operator",
        )
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Incident '{id}' not found.")
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err))


@router.post(
    "/{id}/investigate",
    response_model=IncidentRecord,
    summary="Begin investigation (transition -> INVESTIGATING)",
)
async def start_investigation(
    id: UUID,
    req: Optional[IncidentTransitionRequest] = None,
    auth: AuthContext = Depends(require_sandbox_operator),
):
    """Transitions incident status to INVESTIGATING."""
    try:
        return incident_service.transition_incident(
            incident_id=id,
            tenant_id=auth.tenant_id,
            target_status=IncidentStatus.INVESTIGATING,
            user_id=str(auth.user_id),
            note=req.note if req else "Operator initiated triage and investigation",
        )
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Incident '{id}' not found.")
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err))


@router.post(
    "/{id}/resolve",
    response_model=IncidentRecord,
    summary="Mark incident resolved (transition -> RESOLVED)",
)
async def resolve_incident(
    id: UUID,
    req: Optional[IncidentTransitionRequest] = None,
    auth: AuthContext = Depends(require_sandbox_operator),
):
    """Transitions incident status to RESOLVED when mitigation or recovery is verified."""
    try:
        return incident_service.transition_incident(
            incident_id=id,
            tenant_id=auth.tenant_id,
            target_status=IncidentStatus.RESOLVED,
            user_id=str(auth.user_id),
            note=req.note if req else "Resolved by operator mitigation",
        )
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Incident '{id}' not found.")
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err))


@router.post(
    "/{id}/close",
    response_model=IncidentRecord,
    summary="Close an incident (transition -> CLOSED)",
)
async def close_incident(
    id: UUID,
    req: Optional[IncidentTransitionRequest] = None,
    auth: AuthContext = Depends(require_sandbox_operator),
):
    """Permanently closes a resolved incident."""
    try:
        return incident_service.transition_incident(
            incident_id=id,
            tenant_id=auth.tenant_id,
            target_status=IncidentStatus.CLOSED,
            user_id=str(auth.user_id),
            note=req.note if req else "Incident closed post-incident review completed",
        )
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Incident '{id}' not found.")
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err))


@router.post(
    "/evaluate",
    response_model=IncidentEvaluationResponse,
    summary="Trigger deterministic rule evaluation loop over sandbox telemetry",
)
async def evaluate_incidents(
    sandbox_id: UUID = Query(..., description="Target sandbox identifier"),
    project_id: UUID = Query(..., description="Target project identifier"),
    active_experiment: Optional[Dict[str, Any]] = None,
    auth: AuthContext = Depends(require_sandbox_operator),
):
    """Executes the deterministic detection and deduplication loop across sandbox microservices."""
    _verify_sandbox_access(sandbox_id, auth)
    res = incident_service.evaluate_sandbox_incidents(
        tenant_id=auth.tenant_id,
        project_id=project_id,
        sandbox_id=sandbox_id,
        active_experiment=active_experiment,
    )
    return IncidentEvaluationResponse(
        evaluated_services=res["evaluated_services"],
        rules_triggered=res["rules_triggered"],
        incidents_created=res["incidents_created"],
        incidents_updated=res["incidents_updated"],
        incidents_resolved=res["incidents_resolved"],
        timestamp=datetime.now(timezone.utc),
    )
