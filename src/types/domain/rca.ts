export type RCAAnalysisStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'INSUFFICIENT_EVIDENCE';

export type ConfidenceClassification = 'HIGH' | 'MEDIUM' | 'LOW' | 'INCONCLUSIVE';

export type RCAFactorType =
  | 'SPAN_LATENCY_CONTRIBUTION'
  | 'TEMPORAL_PRECEDENCE'
  | 'METRIC_ANOMALY_MAGNITUDE'
  | 'TOPOLOGY_DEPENDENCY_DEPTH'
  | 'EXPERIMENT_ALIGNMENT'
  | 'LOG_SEVERITY_CONCENTRATION'
  | 'POD_READINESS_DEFICIT'
  | 'RECOVERY_CORRELATION';

export interface RCAFactor {
  factor_type: RCAFactorType;
  raw_value: number;
  normalized_score: number;
  weight: number;
  weighted_score: number;
  explanation: string;
  evidence_ids?: string[];
}

export interface RCADependencyPath {
  source_service: string;
  target_service: string;
  hops: number;
  propagation_delay_ms: number;
  is_critical_path: boolean;
  path_segments: string[];
}

export interface RCACandidate {
  candidate_id: string;
  service_id: string;
  service_name: string;
  node_type: string;
  score: number;
  confidence: ConfidenceClassification;
  is_primary_cause: boolean;
  is_collateral_symptom: boolean;
  factors: RCAFactor[];
  supporting_evidence: string[];
  contradicting_evidence: string[];
  affected_paths: string[];
  recommended_actions: string[];
}

export interface RCAEvidence {
  evidence_id: string;
  evidence_type: 'METRIC_ANOMALY' | 'TRACE_LATENCY_SPIKE' | 'LOG_ERROR_EVENT' | 'CHAOS_FAULT_INJECTION' | 'TOPOLOGY_EDGE';
  service_id: string;
  timestamp: string;
  details: Record<string, any>;
  source_reference: string;
}

export interface RCAExecutionMetadata {
  algorithm_version: string;
  execution_duration_ms: number;
  evaluated_services_count: number;
  evaluated_spans_count: number;
  evaluated_metrics_count: number;
  telemetry_freshness: string;
  evaluated_at: string;
}

export interface RCAAnalysis {
  id: string;
  incident_id: string;
  tenant_id: string;
  project_id: string;
  sandbox_id: string;
  topology_id?: string;
  topology_version: number;
  status: RCAAnalysisStatus;
  candidates: RCACandidate[];
  primary_root_cause?: RCACandidate | null;
  collateral_symptoms: RCACandidate[];
  propagation_paths: RCADependencyPath[];
  evidence_items: RCAEvidence[];
  missing_evidence_warnings: string[];
  execution_metadata: RCAExecutionMetadata;
  created_at: string;
  updated_at: string;
}

// Backward-compatible type aliases
export type RootCauseCandidate = RCACandidate;
export type ConfidenceFactor = RCAFactor;
export type CausalClassification = ConfidenceClassification;
export type EvidenceReference = RCAEvidence;
export type RemediationAction = string;
export interface RemediationRunbook {
  id: string;
  title: string;
  steps: string[];
}
export interface AIExplanation {
  summary: string;
  reasoning: string;
}
export type RCAReport = RCAAnalysis;
