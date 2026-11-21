"""Domain models for ChaosEngine AI Automated Incident Detection & SLO Violation Triage (Milestone M7)."""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4
from pydantic import BaseModel, Field


class IncidentSeverity(str, Enum):
    CRITICAL = "CRITICAL"
    WARNING = "WARNING"
    INFO = "INFO"


class IncidentStatus(str, Enum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    INVESTIGATING = "INVESTIGATING"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class RuleFamily(str, Enum):
    LATENCY = "LATENCY"
    ERROR_RATE = "ERROR_RATE"
    AVAILABILITY = "AVAILABILITY"
    RESOURCE = "RESOURCE"
    TRAFFIC = "TRAFFIC"
    SLO_BURN_RATE = "SLO_BURN_RATE"


class ServiceSLODefinition(BaseModel):
    service_id: str
    availability_target_pct: float = Field(default=99.9, description="Target availability percentage (e.g. 99.9%)")
    p99_latency_target_ms: float = Field(default=100.0, description="P99 latency budget in milliseconds")
    rolling_window_hours: int = Field(default=24, description="SLO rolling window evaluation duration")
    fast_burn_threshold: float = Field(default=14.4, description="1h window burn rate triggering critical paging")
    slow_burn_threshold: float = Field(default=6.0, description="6h window burn rate triggering warning triage")


class AlertRuleDefinition(BaseModel):
    rule_id: str
    name: str
    family: RuleFamily
    severity: IncidentSeverity
    metric_name: str
    operator: str = ">"  # '>', '>=', '<', '<='
    threshold: float
    consecutive_breaches: int = Field(default=2, description="Consecutive evaluated breaches required before firing")
    recovery_threshold: float = Field(..., description="Value below which alert clears")


class IncidentLifecycleEvent(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    incident_id: UUID
    from_status: Optional[IncidentStatus] = None
    to_status: IncidentStatus
    triggered_by: str = "SYSTEM_DETECTION_ENGINE"
    timestamp: datetime
    note: str = ""


class IncidentEvidencePackage(BaseModel):
    metric_snapshots: Dict[str, Any] = Field(default_factory=dict)
    latency_change_pct: float = 0.0
    error_rate_pct: float = 0.0
    service_health_status: str = "healthy"
    trace_ids: List[str] = Field(default_factory=list)
    log_ids: List[str] = Field(default_factory=list)
    topology_version: int = 1
    affected_dependency_paths: List[str] = Field(default_factory=list)
    related_experiment_id: Optional[str] = None
    experiment_fault_type: Optional[str] = None
    experiment_magnitude: Optional[float] = None
    started_relative_to_experiment: Optional[str] = None  # "during", "before", "after"
    telemetry_freshness: str = "FRESH"  # "FRESH", "UNCERTAIN", "STALE"


class IncidentRecord(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    fingerprint: str = Field(..., description="Deterministic sha256 hash identifying recurring failure pattern")
    tenant_id: UUID
    project_id: UUID
    sandbox_id: UUID
    primary_affected_service: str
    related_affected_services: List[str] = Field(default_factory=list)
    related_experiment_id: Optional[str] = None
    title: str
    description: str
    severity: IncidentSeverity = IncidentSeverity.WARNING
    status: IncidentStatus = IncidentStatus.OPEN
    detection_source: str = "DETERMINISTIC_SLO_ENGINE"
    triggered_rule_ids: List[str] = Field(default_factory=list)
    first_detected_at: datetime
    last_detected_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    assigned_user: Optional[str] = None
    occurrence_count: int = 1
    evidence_package: IncidentEvidencePackage = Field(default_factory=IncidentEvidencePackage)
    created_at: datetime
    updated_at: datetime


class IncidentListResponse(BaseModel):
    items: List[IncidentRecord]
    total: int


class IncidentTransitionRequest(BaseModel):
    note: Optional[str] = None
    assigned_user: Optional[str] = None


class IncidentEvaluationResponse(BaseModel):
    evaluated_services: int
    rules_triggered: int
    incidents_created: int
    incidents_updated: int
    incidents_resolved: int
    timestamp: datetime
