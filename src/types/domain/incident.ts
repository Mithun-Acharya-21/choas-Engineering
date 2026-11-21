export type IncidentSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
export type IncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED' | 'DETECTED' | 'EVALUATING' | 'ANALYZED';

export interface IncidentEvidencePackage {
  metricSnapshots: Record<string, any>;
  latencyChangePct: number;
  errorRatePct: number;
  serviceHealthStatus: string;
  traceIds: string[];
  logIds: string[];
  topologyVersion: number;
  affectedDependencyPaths: string[];
  relatedExperimentId?: string;
  experimentFaultType?: string;
  experimentMagnitude?: number;
  startedRelativeToExperiment?: 'during' | 'before' | 'after';
  telemetryFreshness: 'FRESH' | 'UNCERTAIN' | 'STALE';
}

export interface IncidentLifecycleEvent {
  id: string;
  incidentId: string;
  fromStatus?: IncidentStatus | null;
  toStatus: IncidentStatus;
  triggeredBy: string;
  timestamp: string;
  note: string;
}

export interface IncidentRecord {
  id: string;
  fingerprint: string;
  tenantId: string;
  projectId: string;
  sandboxId: string;
  primaryAffectedService: string;
  relatedAffectedServices: string[];
  relatedExperimentId?: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  detectionSource: string;
  triggeredRuleIds: string[];
  firstDetectedAt: string;
  lastDetectedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  assignedUser?: string;
  occurrenceCount: number;
  evidencePackage: IncidentEvidencePackage;
  createdAt: string;
  updatedAt: string;
}

// Backward-compatible alias
export type Incident = IncidentRecord;

export interface IncidentEvidence {
  id: string;
  incidentId: string;
  evidenceType: 'TRACE_SPAN' | 'METRIC_ANOMALY' | 'LOG_SNIPPET';
  sourceSystem: 'JAEGER' | 'PROMETHEUS' | 'LOKI';
  rawPayload: Record<string, unknown>;
  capturedAt: string;
}
