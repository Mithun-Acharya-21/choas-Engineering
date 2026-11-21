import {
  IncidentEvidencePackage,
  IncidentLifecycleEvent,
  IncidentRecord,
  IncidentSeverity,
  IncidentStatus,
} from '../../types/domain/incident';
import { IncidentQueryParams } from '../api/incidentService';

const INITIAL_MOCK_INCIDENTS: IncidentRecord[] = [
  {
    id: 'inc-9901-latency-breach',
    fingerprint: 'fp-8f12d8a0c4',
    tenantId: 'tenant-default',
    projectId: 'proj-ecommerce-demo',
    sandboxId: 'sbx-prod-sandbox-01',
    primaryAffectedService: 'payment-ledger',
    relatedAffectedServices: ['checkout-core', 'api-gateway'],
    relatedExperimentId: 'exp-9411',
    title: 'High Latency P99 Breach (> 500ms)',
    description: 'payment-ledger P99 latency breached 500ms critical threshold (measured: 842ms, baseline: 32ms)',
    severity: 'CRITICAL',
    status: 'OPEN',
    detectionSource: 'PROMETHEUS_PROMQL',
    triggeredRuleIds: ['rule-p99-latency', 'rule-slo-fast-burn'],
    firstDetectedAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    lastDetectedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    occurrenceCount: 9,
    evidencePackage: {
      metricSnapshots: {
        'p99_latency_ms': 842.6,
        'p50_latency_ms': 312.4,
        'error_rate_pct': 7.8,
        'cpu_usage_pct': 78.4,
        'slo_burn_rate': 14.8,
      },
      latencyChangePct: 2530.0,
      errorRatePct: 7.8,
      serviceHealthStatus: 'degraded',
      traceIds: ['tr-89f2c4a10e', 'tr-77d19b02f4'],
      logIds: ['log-1084', 'log-1083'],
      topologyVersion: 1,
      affectedDependencyPaths: [
        'api-gateway -> checkout-core -> payment-ledger',
      ],
      relatedExperimentId: 'exp-9411',
      experimentFaultType: 'LATENCY_INJECTION',
      experimentMagnitude: 500,
      startedRelativeToExperiment: 'during',
      telemetryFreshness: 'FRESH',
    },
    createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
  {
    id: 'inc-9902-error-rate',
    fingerprint: 'fp-33a1e9c201',
    tenantId: 'tenant-default',
    projectId: 'proj-ecommerce-demo',
    sandboxId: 'sbx-prod-sandbox-01',
    primaryAffectedService: 'checkout-core',
    relatedAffectedServices: ['api-gateway'],
    relatedExperimentId: 'exp-9412',
    title: 'HTTP 5xx Error Rate Surge (> 5%)',
    description: 'checkout-core error rate exceeded 5% threshold across last 3 evaluation intervals (measured: 6.2%)',
    severity: 'WARNING',
    status: 'INVESTIGATING',
    detectionSource: 'PROMETHEUS_PROMQL',
    triggeredRuleIds: ['rule-http-5xx-rate'],
    firstDetectedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    lastDetectedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    acknowledgedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    assignedUser: 'devops-lead@company.local',
    occurrenceCount: 14,
    evidencePackage: {
      metricSnapshots: {
        'error_rate_pct': 6.2,
        'p99_latency_ms': 288.0,
        'pods_ready': 1,
        'pods_desired': 1,
      },
      latencyChangePct: 180.0,
      errorRatePct: 6.2,
      serviceHealthStatus: 'degraded',
      traceIds: ['tr-77d19b02f4'],
      logIds: ['log-1083'],
      topologyVersion: 1,
      affectedDependencyPaths: [
        'api-gateway -> checkout-core',
      ],
      relatedExperimentId: 'exp-9412',
      experimentFaultType: 'PACKET_LOSS',
      experimentMagnitude: 20,
      startedRelativeToExperiment: 'during',
      telemetryFreshness: 'FRESH',
    },
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
  {
    id: 'inc-9903-pod-restart',
    fingerprint: 'fp-b09e847aa3',
    tenantId: 'tenant-default',
    projectId: 'proj-ecommerce-demo',
    sandboxId: 'sbx-prod-sandbox-01',
    primaryAffectedService: 'inventory-cache',
    relatedAffectedServices: [],
    title: 'Pod Readiness Deficit & Flapping Restarts',
    description: 'inventory-cache pod failed liveness probe, restart count incremented to 3',
    severity: 'INFO',
    status: 'RESOLVED',
    detectionSource: 'K8S_CONTAINER_RUNTIME',
    triggeredRuleIds: ['rule-pod-readiness'],
    firstDetectedAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    lastDetectedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    acknowledgedAt: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
    resolvedAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    assignedUser: 'sre-engineer@company.local',
    occurrenceCount: 3,
    evidencePackage: {
      metricSnapshots: {
        'pods_ready': 1,
        'pods_desired': 1,
        'restart_count': 3,
      },
      latencyChangePct: 0,
      errorRatePct: 0.1,
      serviceHealthStatus: 'healthy',
      traceIds: [],
      logIds: [],
      topologyVersion: 1,
      affectedDependencyPaths: [],
      telemetryFreshness: 'FRESH',
    },
    createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
  },
];

let mockIncidents = [...INITIAL_MOCK_INCIDENTS];

const mockTimelines: Record<string, IncidentLifecycleEvent[]> = {
  'inc-9901-latency-breach': [
    {
      id: 'evt-01',
      incidentId: 'inc-9901-latency-breach',
      fromStatus: null,
      toStatus: 'OPEN',
      triggeredBy: 'SYSTEM_DETECTION_ENGINE',
      timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
      note: 'Telemetry breach detected by PromQL rule-p99-latency: P99=842ms (> 500ms)',
    },
  ],
  'inc-9902-error-rate': [
    {
      id: 'evt-11',
      incidentId: 'inc-9902-error-rate',
      fromStatus: null,
      toStatus: 'OPEN',
      triggeredBy: 'SYSTEM_DETECTION_ENGINE',
      timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      note: 'Telemetry breach detected: 5xx error rate 6.2% (> 5.0%)',
    },
    {
      id: 'evt-12',
      incidentId: 'inc-9902-error-rate',
      fromStatus: 'OPEN',
      toStatus: 'ACKNOWLEDGED',
      triggeredBy: 'devops-lead@company.local',
      timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      note: 'Acknowledged by on-call engineer',
    },
    {
      id: 'evt-13',
      incidentId: 'inc-9902-error-rate',
      fromStatus: 'ACKNOWLEDGED',
      toStatus: 'INVESTIGATING',
      triggeredBy: 'devops-lead@company.local',
      timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      note: 'Correlating with experiment exp-9412 packet loss injection',
    },
  ],
  'inc-9903-pod-restart': [
    {
      id: 'evt-21',
      incidentId: 'inc-9903-pod-restart',
      fromStatus: null,
      toStatus: 'OPEN',
      triggeredBy: 'SYSTEM_DETECTION_ENGINE',
      timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
      note: 'Pod readiness deficit detected',
    },
    {
      id: 'evt-22',
      incidentId: 'inc-9903-pod-restart',
      fromStatus: 'OPEN',
      toStatus: 'RESOLVED',
      triggeredBy: 'SYSTEM_AUTO_RECOVERY',
      timestamp: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
      note: 'Metrics recovered below recovery threshold. Pod 1/1 ready.',
    },
  ],
};

export const mockIncidentService = {
  reset() {
    mockIncidents = JSON.parse(JSON.stringify(INITIAL_MOCK_INCIDENTS));
  },

  async listIncidents(queryParams?: IncidentQueryParams): Promise<{ items: IncidentRecord[]; total: number }> {
    let result = [...mockIncidents];
    if (queryParams?.status) {
      result = result.filter((i) => i.status.toUpperCase() === queryParams.status!.toUpperCase());
    }
    if (queryParams?.severity) {
      result = result.filter((i) => i.severity.toUpperCase() === queryParams.severity!.toUpperCase());
    }
    if (queryParams?.service) {
      result = result.filter((i) => i.primaryAffectedService.toLowerCase() === queryParams.service!.toLowerCase());
    }
    return { items: result, total: result.length };
  },

  async getIncident(id: string): Promise<IncidentRecord> {
    const inc = mockIncidents.find((i) => i.id === id);
    if (!inc) {
      throw new Error(`Incident ${id} not found`);
    }
    return inc;
  },

  async getTimeline(id: string): Promise<IncidentLifecycleEvent[]> {
    return mockTimelines[id] || [];
  },

  async getEvidence(id: string): Promise<IncidentEvidencePackage> {
    const inc = await this.getIncident(id);
    return inc.evidencePackage;
  },

  async acknowledgeIncident(id: string, note?: string): Promise<IncidentRecord> {
    const inc = await this.getIncident(id);
    const prev = inc.status;
    inc.status = 'ACKNOWLEDGED';
    inc.acknowledgedAt = new Date().toISOString();
    inc.updatedAt = new Date().toISOString();
    recordEvent(id, prev, 'ACKNOWLEDGED', 'current-user', note || 'Acknowledged by operator');
    return inc;
  },

  async investigateIncident(id: string, note?: string): Promise<IncidentRecord> {
    const inc = await this.getIncident(id);
    const prev = inc.status;
    inc.status = 'INVESTIGATING';
    inc.updatedAt = new Date().toISOString();
    recordEvent(id, prev, 'INVESTIGATING', 'current-user', note || 'Investigating root cause');
    return inc;
  },

  async resolveIncident(id: string, note?: string): Promise<IncidentRecord> {
    const inc = await this.getIncident(id);
    const prev = inc.status;
    inc.status = 'RESOLVED';
    inc.resolvedAt = new Date().toISOString();
    inc.updatedAt = new Date().toISOString();
    recordEvent(id, prev, 'RESOLVED', 'current-user', note || 'Resolved by operator');
    return inc;
  },

  async closeIncident(id: string, note?: string): Promise<IncidentRecord> {
    const inc = await this.getIncident(id);
    const prev = inc.status;
    inc.status = 'CLOSED';
    inc.closedAt = new Date().toISOString();
    inc.updatedAt = new Date().toISOString();
    recordEvent(id, prev, 'CLOSED', 'current-user', note || 'Closed by operator');
    return inc;
  },

  async evaluateIncidents(sandboxId: string, projectId: string, activeExperiment?: any): Promise<any> {
    return {
      evaluatedAt: new Date().toISOString(),
      freshness: 'FRESH',
      breachesDetected: 1,
      incidentsCreated: 0,
      incidentsUpdated: 1,
      incidentsAutoResolved: 0,
    };
  },
};

function recordEvent(
  incidentId: string,
  fromStatus: IncidentStatus | null,
  toStatus: IncidentStatus,
  triggeredBy: string,
  note: string
) {
  if (!mockTimelines[incidentId]) {
    mockTimelines[incidentId] = [];
  }
  mockTimelines[incidentId].push({
    id: `evt-${Date.now()}`,
    incidentId,
    fromStatus,
    toStatus,
    triggeredBy,
    timestamp: new Date().toISOString(),
    note,
  });
}
