import {
  IncidentEvidencePackage,
  IncidentLifecycleEvent,
  IncidentRecord,
} from '../../types/domain/incident';
import { apiClient } from './apiClient';

export interface IncidentQueryParams {
  [key: string]: string | number | boolean | undefined;
  sandbox_id?: string;
  status?: string;
  severity?: string;
  service?: string;
  limit?: number;
  offset?: number;
}

export const incidentService = {
  async listIncidents(queryParams?: IncidentQueryParams): Promise<{ items: IncidentRecord[]; total: number }> {
    const raw = await apiClient.get<any>('/incidents', queryParams);
    if (raw && Array.isArray(raw.items)) {
      return {
        items: raw.items.map(mapIncidentRecord),
        total: raw.total ?? raw.items.length,
      };
    }
    return { items: [], total: 0 };
  },

  async getIncident(id: string): Promise<IncidentRecord> {
    const raw = await apiClient.get<any>(`/incidents/${id}`);
    return mapIncidentRecord(raw);
  },

  async getTimeline(id: string): Promise<IncidentLifecycleEvent[]> {
    const raw = await apiClient.get<any[]>(`/incidents/${id}/timeline`);
    return (raw || []).map((e: any) => ({
      id: e.id,
      incidentId: e.incident_id,
      fromStatus: e.from_status,
      toStatus: e.to_status,
      triggeredBy: e.triggered_by,
      timestamp: e.timestamp,
      note: e.note || '',
    }));
  },

  async getEvidence(id: string): Promise<IncidentEvidencePackage> {
    const raw = await apiClient.get<any>(`/incidents/${id}/evidence`);
    return mapEvidencePackage(raw);
  },

  async acknowledgeIncident(id: string, note?: string): Promise<IncidentRecord> {
    const raw = await apiClient.post<any>(`/incidents/${id}/acknowledge`, { note });
    return mapIncidentRecord(raw);
  },

  async investigateIncident(id: string, note?: string): Promise<IncidentRecord> {
    const raw = await apiClient.post<any>(`/incidents/${id}/investigate`, { note });
    return mapIncidentRecord(raw);
  },

  async resolveIncident(id: string, note?: string): Promise<IncidentRecord> {
    const raw = await apiClient.post<any>(`/incidents/${id}/resolve`, { note });
    return mapIncidentRecord(raw);
  },

  async closeIncident(id: string, note?: string): Promise<IncidentRecord> {
    const raw = await apiClient.post<any>(`/incidents/${id}/close`, { note });
    return mapIncidentRecord(raw);
  },

  async evaluateIncidents(sandboxId: string, projectId: string, activeExperiment?: any): Promise<any> {
    const sp = new URLSearchParams({ sandbox_id: sandboxId, project_id: projectId });
    return apiClient.post(`/incidents/evaluate?${sp.toString()}`, activeExperiment);
  },

  // Backward compatibility stubs for M8/M9
  async analyzeIncident(id: string): Promise<any> {
    return apiClient.post(`/incidents/${id}/analyze`);
  },

  async getReport(id: string, format: 'json' | 'markdown' | 'pdf' = 'json'): Promise<unknown> {
    return apiClient.get(`/incidents/${id}/report`, { format });
  },
};

function mapEvidencePackage(raw: any): IncidentEvidencePackage {
  if (!raw) {
    return {
      metricSnapshots: {},
      latencyChangePct: 0,
      errorRatePct: 0,
      serviceHealthStatus: 'healthy',
      traceIds: [],
      logIds: [],
      topologyVersion: 1,
      affectedDependencyPaths: [],
      telemetryFreshness: 'FRESH',
    };
  }
  return {
    metricSnapshots: raw.metric_snapshots || {},
    latencyChangePct: raw.latency_change_pct || 0,
    errorRatePct: raw.error_rate_pct || 0,
    serviceHealthStatus: raw.service_health_status || 'healthy',
    traceIds: raw.trace_ids || [],
    logIds: raw.log_ids || [],
    topologyVersion: raw.topology_version || 1,
    affectedDependencyPaths: raw.affected_dependency_paths || [],
    relatedExperimentId: raw.related_experiment_id,
    experimentFaultType: raw.experiment_fault_type,
    experimentMagnitude: raw.experiment_magnitude,
    startedRelativeToExperiment: raw.started_relative_to_experiment,
    telemetryFreshness: raw.telemetry_freshness || 'FRESH',
  };
}

function mapIncidentRecord(raw: any): IncidentRecord {
  return {
    id: raw.id,
    fingerprint: raw.fingerprint || '',
    tenantId: raw.tenant_id,
    projectId: raw.project_id,
    sandboxId: raw.sandbox_id,
    primaryAffectedService: raw.primary_affected_service || 'payment-service',
    relatedAffectedServices: raw.related_affected_services || [],
    relatedExperimentId: raw.related_experiment_id,
    title: raw.title || 'Service Degradation Detected',
    description: raw.description || '',
    severity: raw.severity || 'WARNING',
    status: raw.status || 'OPEN',
    detectionSource: raw.detection_source || 'DETERMINISTIC_SLO_ENGINE',
    triggeredRuleIds: raw.triggered_rule_ids || [],
    firstDetectedAt: raw.first_detected_at || new Date().toISOString(),
    lastDetectedAt: raw.last_detected_at || new Date().toISOString(),
    acknowledgedAt: raw.acknowledged_at,
    resolvedAt: raw.resolved_at,
    closedAt: raw.closed_at,
    assignedUser: raw.assigned_user,
    occurrenceCount: raw.occurrence_count || 1,
    evidencePackage: mapEvidencePackage(raw.evidence_package),
    createdAt: raw.created_at || new Date().toISOString(),
    updatedAt: raw.updated_at || new Date().toISOString(),
  };
}
