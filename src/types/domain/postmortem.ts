/**
 * Domain types for AI-Assisted RCA Explanations and Incident Postmortems (Milestone M9).
 */

export type AIExplanationStatus = 'GENERATING' | 'COMPLETED' | 'FAILED' | 'FALLBACK_GENERATED';

export type AIRecommendationCategory =
  | 'IMMEDIATE_MITIGATION'
  | 'ROOT_CAUSE_REMEDIATION'
  | 'PREVENTIVE_ACTION';

export type ActionItemPriority = 'P0_CRITICAL' | 'P1_HIGH' | 'P2_MEDIUM' | 'P3_LOW';

export type ActionItemStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type PostmortemStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED';

export interface AIRecommendation {
  id: string;
  title: string;
  category: AIRecommendationCategory;
  priority: ActionItemPriority;
  description: string;
  rationale: string;
  estimated_effort: string;
  risk_tradeoff: string;
  requires_human_approval: boolean;
  supporting_evidence_ids: string[];
}

export interface AIExplanationSection {
  section_type: string;
  title: string;
  content: string;
  cited_evidence_ids: string[];
  confidence_note?: string;
}

export interface AIIncidentExplanation {
  incident_id: string;
  rca_analysis_id: string;
  executive_summary: string;
  technical_narrative: string;
  failure_propagation_walkthrough: string;
  recommendations: AIRecommendation[];
  sections: AIExplanationSection[];
  cited_evidence_ids: string[];
  unverified_citations: string[];
  hallucination_detected: boolean;
  status: AIExplanationStatus;
  provider: string;
  model_name: string;
  is_deterministic_fallback: boolean;
  generated_at: string;
  generation_duration_ms: number;
}

export interface PostmortemActionItem {
  id: string;
  title: string;
  description: string;
  priority: ActionItemPriority;
  status: ActionItemStatus;
  assigned_to?: string;
  due_date?: string;
  supporting_evidence_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface IncidentPostmortem {
  id: string;
  incident_id: string;
  tenant_id: string;
  project_id: string;
  sandbox_id: string;
  title: string;
  status: PostmortemStatus;
  version: number;

  // Authoritative deterministic M8 findings
  primary_root_cause_service: string;
  primary_root_cause_score: number;
  primary_root_cause_confidence: string;
  deterministic_propagation_path: string[];
  m8_analysis_id: string;

  // AI-Assisted Narrative Synthesis (M9)
  executive_summary: string;
  incident_timeline: Array<{ time: string; event: string }>;
  technical_narrative: string;
  impact_assessment: Record<string, any>;
  recommendations: AIRecommendation[];
  action_items: PostmortemActionItem[];

  // Audit & Governance
  created_by: string;
  reviewed_by?: string;
  approved_by?: string;
  published_by?: string;
  approved_at?: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

export interface GenerateExplanationRequest {
  force_refresh?: boolean;
  provider?: string;
  model_name?: string;
}

export interface GeneratePostmortemRequest {
  title?: string;
  force_refresh?: boolean;
}

export interface SingleActionItemUpdate {
  title?: string;
  description?: string;
  priority?: ActionItemPriority;
  status?: ActionItemStatus;
  assigned_to?: string;
  due_date?: string;
}

export interface LifecycleTransitionRequest {
  target_status: PostmortemStatus;
  reviewer_notes?: string;
}
