"""Domain models for Deterministic Root Cause Analysis (RCA) Engine (Milestone M8)."""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4
from pydantic import BaseModel, ConfigDict, Field


class RCAAnalysisStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"


class ConfidenceClassification(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INCONCLUSIVE = "INCONCLUSIVE"


class RCAFactorType(str, Enum):
    SPAN_LATENCY_CONTRIBUTION = "SPAN_LATENCY_CONTRIBUTION"
    TEMPORAL_PRECEDENCE = "TEMPORAL_PRECEDENCE"
    METRIC_ANOMALY_MAGNITUDE = "METRIC_ANOMALY_MAGNITUDE"
    TOPOLOGY_DEPENDENCY_DEPTH = "TOPOLOGY_DEPENDENCY_DEPTH"
    EXPERIMENT_ALIGNMENT = "EXPERIMENT_ALIGNMENT"
    LOG_SEVERITY_CONCENTRATION = "LOG_SEVERITY_CONCENTRATION"
    POD_READINESS_DEFICIT = "POD_READINESS_DEFICIT"
    RECOVERY_CORRELATION = "RECOVERY_CORRELATION"


class RCAEvidenceType(str, Enum):
    METRIC_ANOMALY = "METRIC_ANOMALY"
    TRACE_LATENCY_SPIKE = "TRACE_LATENCY_SPIKE"
    LOG_ERROR_EVENT = "LOG_ERROR_EVENT"
    CHAOS_FAULT_INJECTION = "CHAOS_FAULT_INJECTION"
    TOPOLOGY_EDGE = "TOPOLOGY_EDGE"


class RCAEvidence(BaseModel):
    evidence_id: str = Field(default_factory=lambda: f"ev-{uuid4().hex[:8]}")
    evidence_type: RCAEvidenceType
    service_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    details: Dict[str, Any] = Field(default_factory=dict)
    source_reference: str  # e.g. "prometheus:p99", "jaeger:tr-89f2c4a10e:sp-04", "loki:log-1084"


class RCAFactor(BaseModel):
    factor_type: RCAFactorType
    raw_value: float
    normalized_score: float = Field(..., ge=0.0, le=1.0, description="Score normalized between 0.0 and 1.0")
    weight: float = Field(..., ge=0.0, le=1.0, description="Relative weight in algorithm version")
    weighted_score: float = Field(..., ge=0.0, description="normalized_score * weight * 100")
    explanation: str
    evidence_ids: List[str] = Field(default_factory=list)


class RCADependencyPath(BaseModel):
    source_service: str
    target_service: str
    hops: int = 1
    propagation_delay_ms: float = 0.0
    is_critical_path: bool = False
    path_segments: List[str] = Field(default_factory=list)  # e.g. ["api-gateway", "order-service", "payment-service"]


class RCACandidate(BaseModel):
    candidate_id: str = Field(default_factory=lambda: f"cand-{uuid4().hex[:8]}")
    service_id: str
    service_name: str
    node_type: str = "app_service"
    score: float = Field(..., ge=0.0, le=100.0, description="Deterministic confidence score (0.0 to 100.0)")
    confidence: ConfidenceClassification = ConfidenceClassification.MEDIUM
    is_primary_cause: bool = False
    is_collateral_symptom: bool = False
    factors: List[RCAFactor] = Field(default_factory=list)
    supporting_evidence: List[str] = Field(default_factory=list)
    contradicting_evidence: List[str] = Field(default_factory=list)
    affected_paths: List[str] = Field(default_factory=list)
    recommended_actions: List[str] = Field(default_factory=list)


class RCAExecutionMetadata(BaseModel):
    algorithm_version: str = "v1.0.0-deterministic"
    execution_duration_ms: float = 0.0
    evaluated_services_count: int = 0
    evaluated_spans_count: int = 0
    evaluated_metrics_count: int = 0
    telemetry_freshness: str = "FRESH"
    evaluated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RCAAnalysis(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(default_factory=uuid4)
    incident_id: UUID
    tenant_id: UUID
    project_id: UUID
    sandbox_id: UUID
    topology_id: Optional[UUID] = None
    topology_version: int = 1
    status: RCAAnalysisStatus = RCAAnalysisStatus.PENDING
    candidates: List[RCACandidate] = Field(default_factory=list)
    primary_root_cause: Optional[RCACandidate] = None
    collateral_symptoms: List[RCACandidate] = Field(default_factory=list)
    propagation_paths: List[RCADependencyPath] = Field(default_factory=list)
    evidence_items: List[RCAEvidence] = Field(default_factory=list)
    missing_evidence_warnings: List[str] = Field(default_factory=list)
    execution_metadata: RCAExecutionMetadata = Field(default_factory=RCAExecutionMetadata)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# API Schemas
class RCARunRequest(BaseModel):
    algorithm_version: Optional[str] = "v1.0.0-deterministic"
    force_recompute: bool = False


class RCARerunRequest(BaseModel):
    algorithm_version: str = "v1.0.0-deterministic"
    custom_weights: Optional[Dict[str, float]] = None


class RCAAnalysisResponse(BaseModel):
    analysis: RCAAnalysis


class RCACandidateListResponse(BaseModel):
    analysis_id: UUID
    incident_id: UUID
    status: RCAAnalysisStatus
    algorithm_version: str
    candidates: List[RCACandidate]
    primary_root_cause: Optional[RCACandidate] = None
    collateral_symptoms: List[RCACandidate] = Field(default_factory=list)


class RCAPropagationResponse(BaseModel):
    analysis_id: UUID
    incident_id: UUID
    paths: List[RCADependencyPath]
    primary_fault_origin: Optional[str] = None
