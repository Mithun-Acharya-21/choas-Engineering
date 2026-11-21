"""Domain models for AI-Assisted RCA Explanation & Postmortem Generation (Milestone M9)."""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4
from pydantic import BaseModel, ConfigDict, Field


class AIExplanationStatus(str, Enum):
    GENERATING = "GENERATING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    FALLBACK_GENERATED = "FALLBACK_GENERATED"


class AIRecommendationCategory(str, Enum):
    IMMEDIATE_MITIGATION = "IMMEDIATE_MITIGATION"
    ROOT_CAUSE_REMEDIATION = "ROOT_CAUSE_REMEDIATION"
    PREVENTIVE_ACTION = "PREVENTIVE_ACTION"


class ActionItemPriority(str, Enum):
    P0_CRITICAL = "P0_CRITICAL"
    P1_HIGH = "P1_HIGH"
    P2_MEDIUM = "P2_MEDIUM"
    P3_LOW = "P3_LOW"


class ActionItemStatus(str, Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class PostmortemStatus(str, Enum):
    DRAFT = "DRAFT"
    IN_REVIEW = "IN_REVIEW"
    APPROVED = "APPROVED"
    PUBLISHED = "PUBLISHED"


class AIRecommendation(BaseModel):
    id: str = Field(default_factory=lambda: f"rec-{uuid4().hex[:8]}")
    title: str
    category: AIRecommendationCategory
    priority: ActionItemPriority = ActionItemPriority.P1_HIGH
    description: str
    rationale: str
    estimated_effort: str = "Medium (1-2 sprints)"
    risk_tradeoff: str
    requires_human_approval: bool = True  # Strict safety rule: Recommendations require human action
    supporting_evidence_ids: List[str] = Field(default_factory=list)


class AIExplanationSection(BaseModel):
    section_type: str  # executive_summary, technical_narrative, propagation_walkthrough, telemetry_breakdown
    title: str
    content: str
    cited_evidence_ids: List[str] = Field(default_factory=list)
    confidence_note: Optional[str] = None


class AIIncidentExplanation(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    incident_id: UUID
    rca_analysis_id: UUID
    executive_summary: str
    technical_narrative: str
    failure_propagation_walkthrough: str
    recommendations: List[AIRecommendation] = Field(default_factory=list)
    sections: List[AIExplanationSection] = Field(default_factory=list)
    cited_evidence_ids: List[str] = Field(default_factory=list)
    unverified_citations: List[str] = Field(default_factory=list)
    hallucination_detected: bool = False
    status: AIExplanationStatus = AIExplanationStatus.COMPLETED
    provider: str = "mock"
    model_name: str = "llama-3.3-70b-versatile"
    is_deterministic_fallback: bool = False
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    generation_duration_ms: float = 0.0


class PostmortemActionItem(BaseModel):
    id: str = Field(default_factory=lambda: f"act-{uuid4().hex[:8]}")
    title: str
    description: str
    priority: ActionItemPriority = ActionItemPriority.P1_HIGH
    status: ActionItemStatus = ActionItemStatus.OPEN
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None
    supporting_evidence_ids: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class IncidentPostmortem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(default_factory=uuid4)
    incident_id: UUID
    tenant_id: UUID
    project_id: UUID
    sandbox_id: UUID
    title: str
    status: PostmortemStatus = PostmortemStatus.DRAFT
    version: int = 1
    
    # Authoritative deterministic findings from M8 (Authoritative Ground Truth)
    primary_root_cause_service: str
    primary_root_cause_score: float
    primary_root_cause_confidence: str
    deterministic_propagation_path: List[str] = Field(default_factory=list)
    m8_analysis_id: UUID

    # AI-Assisted Narrative Synthesis (M9)
    executive_summary: str
    incident_timeline: List[Dict[str, Any]] = Field(default_factory=list)
    technical_narrative: str
    impact_assessment: Dict[str, Any] = Field(default_factory=dict)
    recommendations: List[AIRecommendation] = Field(default_factory=list)
    action_items: List[PostmortemActionItem] = Field(default_factory=list)
    
    # Audit & Lifecycle tracking
    created_by: str = "system"
    reviewed_by: Optional[str] = None
    approved_by: Optional[str] = None
    published_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# API Request / Response schemas
class GenerateExplanationRequest(BaseModel):
    force_refresh: bool = False
    provider: Optional[str] = None
    model_name: Optional[str] = None


class GeneratePostmortemRequest(BaseModel):
    title: Optional[str] = None
    force_refresh: bool = False


class ActionItemUpdateRequest(BaseModel):
    action_items: List[PostmortemActionItem]


class SingleActionItemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[ActionItemPriority] = None
    status: Optional[ActionItemStatus] = None
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None


class LifecycleTransitionRequest(BaseModel):
    target_status: PostmortemStatus
    reviewer_notes: Optional[str] = None
