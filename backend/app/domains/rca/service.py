"""RCA Management Service, Multi-Tenant Persistence, and Analysis Lifecycle (Milestone M8)."""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID, uuid4

from backend.app.domains.incident.service import incident_service
from backend.app.domains.observability.engine import observability_service
from backend.app.domains.rca.engine import (
    DEFAULT_ALGORITHM_VERSION,
    DEFAULT_WEIGHTS,
    DeterministicRCAEngine,
)
from backend.app.domains.rca.graph import DependencyGraphAnalyzer
from backend.app.domains.rca.models import (
    RCAAnalysis,
    RCAAnalysisStatus,
    RCACandidate,
    RCADependencyPath,
    RCAEvidence,
    RCAFactorType,
)

logger = logging.getLogger("chaosengine.rca_service")

# In-memory thread-safe storage tables simulating PostgreSQL repository
_RCA_ANALYSES_DB: Dict[UUID, RCAAnalysis] = {}
_INCIDENT_RCA_INDEX: Dict[UUID, List[UUID]] = {}


class RCAService:
    """Manages RCA lifecycle, multi-tenant isolation, idempotent execution, and persistence."""

    def __init__(self, engine: Optional[DeterministicRCAEngine] = None):
        self.engine = engine or DeterministicRCAEngine()

    def run_analysis(
        self,
        incident_id: UUID,
        tenant_id: UUID,
        algorithm_version: str = DEFAULT_ALGORITHM_VERSION,
        custom_weights: Optional[Dict[str, float]] = None,
        force_recompute: bool = False,
    ) -> RCAAnalysis:
        """Executes or retrieves deterministic RCA analysis for an incident."""
        # 1. Tenant Scoping & Incident Access Check
        incident = incident_service.get_incident(incident_id, tenant_id)

        # 2. Check existing completed analysis (Idempotency)
        if not force_recompute and incident_id in _INCIDENT_RCA_INDEX:
            past_ids = _INCIDENT_RCA_INDEX[incident_id]
            for past_id in reversed(past_ids):
                past = _RCA_ANALYSES_DB.get(past_id)
                if past and past.execution_metadata.algorithm_version == algorithm_version:
                    logger.info(f"Returning cached RCA analysis {past_id} for incident {incident_id}")
                    return past

        # 3. Ingest M6 Telemetry (Metrics, Traces, Logs, Health)
        sbx_id_str = str(incident.sandbox_id)
        metrics = observability_service.get_service_metrics(sandbox_id=sbx_id_str)
        traces = observability_service.get_distributed_traces(
            sandbox_id=sbx_id_str,
            limit=10,
            fault_injected=bool(incident.related_experiment_id),
            fault_magnitude_ms=float(incident.evidence_package.experiment_magnitude or 2000.0),
        )
        logs = observability_service.get_structured_logs(sandbox_id=sbx_id_str, limit=20)
        health = observability_service.get_service_health(sandbox_id=sbx_id_str)

        active_experiment = None
        if incident.related_experiment_id:
            active_experiment = {
                "id": incident.related_experiment_id,
                "target_service": incident.primary_affected_service,
                "fault_type": incident.evidence_package.experiment_fault_type or "LATENCY",
                "magnitude": incident.evidence_package.experiment_magnitude or 2000.0,
                "status": "RUNNING",
            }

        # 4. Initialize Dependency Graph from M4
        graph_analyzer = DependencyGraphAnalyzer.from_e_commerce_default()

        # 5. Execute Deterministic Scoring Engine
        weights = None
        if custom_weights:
            weights = {RCAFactorType(k): v for k, v in custom_weights.items() if k in RCAFactorType.__members__}

        engine = DeterministicRCAEngine(weights=weights, algorithm_version=algorithm_version)
        (
            status,
            candidates,
            primary_cause,
            collateral_symptoms,
            propagation_paths,
            evidence_items,
            missing_warnings,
            metadata,
        ) = engine.analyze(
            incident=incident,
            graph_analyzer=graph_analyzer,
            metrics=metrics,
            traces=traces,
            logs=logs,
            health=health,
            active_experiment=active_experiment,
        )

        analysis_id = uuid4()
        now = datetime.now(timezone.utc)
        record = RCAAnalysis(
            id=analysis_id,
            incident_id=incident_id,
            tenant_id=tenant_id,
            project_id=incident.project_id,
            sandbox_id=incident.sandbox_id,
            topology_id=None,
            topology_version=incident.evidence_package.topology_version,
            status=status,
            candidates=candidates,
            primary_root_cause=primary_cause,
            collateral_symptoms=collateral_symptoms,
            propagation_paths=propagation_paths,
            evidence_items=evidence_items,
            missing_evidence_warnings=missing_warnings,
            execution_metadata=metadata,
            created_at=now,
            updated_at=now,
        )

        # 6. Persist to Repository
        _RCA_ANALYSES_DB[analysis_id] = record
        _INCIDENT_RCA_INDEX.setdefault(incident_id, []).append(analysis_id)

        logger.info(
            f"RCA analysis {analysis_id} completed for incident {incident_id}: "
            f"primary={primary_cause.service_id if primary_cause else 'None'} status={status}"
        )
        return record

    def get_analysis(self, analysis_id: UUID, tenant_id: UUID) -> RCAAnalysis:
        """Retrieves an analysis verifying tenant isolation."""
        analysis = _RCA_ANALYSES_DB.get(analysis_id)
        if not analysis or analysis.tenant_id != tenant_id:
            raise KeyError(f"RCA Analysis '{analysis_id}' not found in active tenant.")
        return analysis

    def get_latest_analysis_for_incident(self, incident_id: UUID, tenant_id: UUID) -> Optional[RCAAnalysis]:
        """Retrieves the most recent RCA analysis for an incident."""
        incident_service.get_incident(incident_id, tenant_id)
        past_ids = _INCIDENT_RCA_INDEX.get(incident_id, [])
        if not past_ids:
            return None
        return self.get_analysis(past_ids[-1], tenant_id)

    def get_candidates(self, analysis_id: UUID, tenant_id: UUID) -> List[RCACandidate]:
        """Retrieves ranked candidates for an analysis."""
        analysis = self.get_analysis(analysis_id, tenant_id)
        return analysis.candidates

    def get_evidence(self, analysis_id: UUID, tenant_id: UUID) -> List[RCAEvidence]:
        """Retrieves evidence items for an analysis."""
        analysis = self.get_analysis(analysis_id, tenant_id)
        return analysis.evidence_items

    def get_propagation(self, analysis_id: UUID, tenant_id: UUID) -> List[RCADependencyPath]:
        """Retrieves failure propagation paths for an analysis."""
        analysis = self.get_analysis(analysis_id, tenant_id)
        return analysis.propagation_paths


# Global singleton instance
rca_service = RCAService()
