"""FastAPI REST router for Deterministic Root Cause Analysis (Milestone M8)."""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.app.domains.auth.dependencies import (
    AuthContext,
    require_sandbox_operator,
    require_sandbox_viewer,
)
from backend.app.domains.rca.models import (
    RCAAnalysis,
    RCAAnalysisResponse,
    RCACandidate,
    RCACandidateListResponse,
    RCADependencyPath,
    RCAEvidence,
    RCAPropagationResponse,
    RCARerunRequest,
    RCARunRequest,
)
from backend.app.domains.rca.service import rca_service

router = APIRouter(tags=["Deterministic Root Cause Analysis (RCA)"])


@router.post(
    "/incidents/{id}/rca/analyze",
    response_model=RCAAnalysis,
    summary="Trigger deterministic RCA analysis for an incident",
)
async def analyze_incident_rca(
    id: UUID,
    req: Optional[RCARunRequest] = None,
    auth: AuthContext = Depends(require_sandbox_operator),
):
    """Executes deterministic multi-factor root cause analysis for an incident."""
    try:
        algo_version = req.algorithm_version if req and req.algorithm_version else "v1.0.0-deterministic"
        force = req.force_recompute if req else False
        return rca_service.run_analysis(
            incident_id=id,
            tenant_id=auth.tenant_id,
            algorithm_version=algo_version,
            force_recompute=force,
        )
    except KeyError as k_err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(k_err))
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(val_err))


@router.get(
    "/incidents/{id}/rca",
    response_model=Optional[RCAAnalysis],
    summary="Retrieve latest RCA analysis for an incident",
)
async def get_latest_incident_rca(
    id: UUID,
    auth: AuthContext = Depends(require_sandbox_viewer),
):
    """Retrieves the most recent deterministic RCA analysis for the target incident."""
    try:
        return rca_service.get_latest_analysis_for_incident(incident_id=id, tenant_id=auth.tenant_id)
    except KeyError as k_err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(k_err))


@router.get(
    "/rca/{analysis_id}",
    response_model=RCAAnalysis,
    summary="Retrieve RCA analysis by analysis ID",
)
async def get_rca_analysis(
    analysis_id: UUID,
    auth: AuthContext = Depends(require_sandbox_viewer),
):
    """Retrieves a specific historical RCA analysis verifying tenant ownership."""
    try:
        return rca_service.get_analysis(analysis_id=analysis_id, tenant_id=auth.tenant_id)
    except KeyError as k_err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(k_err))


@router.get(
    "/rca/{analysis_id}/candidates",
    response_model=RCACandidateListResponse,
    summary="Retrieve ranked candidate root causes and score breakdowns",
)
async def get_rca_candidates(
    analysis_id: UUID,
    auth: AuthContext = Depends(require_sandbox_viewer),
):
    """Retrieves ranked root cause candidates with transparent scoring factor breakdowns."""
    try:
        analysis = rca_service.get_analysis(analysis_id=analysis_id, tenant_id=auth.tenant_id)
        return RCACandidateListResponse(
            analysis_id=analysis.id,
            incident_id=analysis.incident_id,
            status=analysis.status,
            algorithm_version=analysis.execution_metadata.algorithm_version,
            candidates=analysis.candidates,
            primary_root_cause=analysis.primary_root_cause,
            collateral_symptoms=analysis.collateral_symptoms,
        )
    except KeyError as k_err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(k_err))


@router.get(
    "/rca/{analysis_id}/evidence",
    response_model=List[RCAEvidence],
    summary="Retrieve normalized telemetry evidence items for an analysis",
)
async def get_rca_evidence(
    analysis_id: UUID,
    auth: AuthContext = Depends(require_sandbox_viewer),
):
    """Retrieves normalized metrics, spans, logs, and experiment evidence items."""
    try:
        return rca_service.get_evidence(analysis_id=analysis_id, tenant_id=auth.tenant_id)
    except KeyError as k_err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(k_err))


@router.get(
    "/rca/{analysis_id}/propagation",
    response_model=RCAPropagationResponse,
    summary="Retrieve failure propagation paths and causal flow",
)
async def get_rca_propagation(
    analysis_id: UUID,
    auth: AuthContext = Depends(require_sandbox_viewer),
):
    """Retrieves directed dependency propagation paths from root cause to affected callers."""
    try:
        analysis = rca_service.get_analysis(analysis_id=analysis_id, tenant_id=auth.tenant_id)
        origin = analysis.primary_root_cause.service_id if analysis.primary_root_cause else None
        return RCAPropagationResponse(
            analysis_id=analysis.id,
            incident_id=analysis.incident_id,
            paths=analysis.propagation_paths,
            primary_fault_origin=origin,
        )
    except KeyError as k_err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(k_err))


@router.post(
    "/rca/{analysis_id}/rerun",
    response_model=RCAAnalysis,
    summary="Re-run RCA analysis with specified algorithm version and weights",
)
async def rerun_rca_analysis(
    analysis_id: UUID,
    req: RCARerunRequest,
    auth: AuthContext = Depends(require_sandbox_operator),
):
    """Re-runs RCA analysis with configurable weights or version while preserving historical run."""
    try:
        analysis = rca_service.get_analysis(analysis_id=analysis_id, tenant_id=auth.tenant_id)
        return rca_service.run_analysis(
            incident_id=analysis.incident_id,
            tenant_id=auth.tenant_id,
            algorithm_version=req.algorithm_version,
            custom_weights=req.custom_weights,
            force_recompute=True,
        )
    except KeyError as k_err:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(k_err))
