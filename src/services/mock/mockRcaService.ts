import {
  RCAAnalysis,
  RCACandidate,
  RCADependencyPath,
  RCAEvidence,
} from '../../types/domain/rca';

const INITIAL_MOCK_ANALYSES: Record<string, RCAAnalysis> = {
  'inc-9901-latency-breach': {
    id: 'rca-analysis-9901-auto',
    incident_id: 'inc-9901-latency-breach',
    tenant_id: 'tenant-default',
    project_id: 'proj-ecommerce-demo',
    sandbox_id: 'sbx-prod-sandbox-01',
    topology_version: 1,
    status: 'COMPLETED',
    primary_root_cause: {
      candidate_id: 'cand-01-pay',
      service_id: 'payment-ledger',
      service_name: 'Payment Ledger',
      node_type: 'app_service',
      score: 88.5,
      confidence: 'HIGH',
      is_primary_cause: true,
      is_collateral_symptom: false,
      factors: [
        {
          factor_type: 'SPAN_LATENCY_CONTRIBUTION',
          raw_value: 842.0,
          normalized_score: 0.92,
          weight: 0.25,
          weighted_score: 23.0,
          explanation: 'Exclusive internal latency: 842.0ms self-duration in trace waterfall',
        },
        {
          factor_type: 'TEMPORAL_PRECEDENCE',
          raw_value: 0.95,
          normalized_score: 0.95,
          weight: 0.20,
          weighted_score: 19.0,
          explanation: 'First observed SLO breach timestamp in cluster',
        },
        {
          factor_type: 'METRIC_ANOMALY_MAGNITUDE',
          raw_value: 25.3,
          normalized_score: 0.88,
          weight: 0.15,
          weighted_score: 13.2,
          explanation: 'P99 latency surged +2530% over baseline',
        },
        {
          factor_type: 'TOPOLOGY_DEPENDENCY_DEPTH',
          raw_value: 2.0,
          normalized_score: 0.85,
          weight: 0.15,
          weighted_score: 12.8,
          explanation: 'Downstream leaf service in dependency DAG',
        },
        {
          factor_type: 'EXPERIMENT_ALIGNMENT',
          raw_value: 0.95,
          normalized_score: 0.95,
          weight: 0.15,
          weighted_score: 14.2,
          explanation: 'Aligned with active chaos experiment exp-9411 (LATENCY_INJECTION)',
        },
        {
          factor_type: 'LOG_SEVERITY_CONCENTRATION',
          raw_value: 3.0,
          normalized_score: 0.63,
          weight: 0.10,
          weighted_score: 6.3,
          explanation: '3 CRITICAL timeout and retry logs recorded',
        },
      ],
      supporting_evidence: [
        'Exclusive span self-duration measured at 842.0ms (94% of total trace latency).',
        'Direct target of active Toxiproxy chaos latency injection exp-9411.',
        'Earliest observed SLO violation timestamp recorded in sandbox.',
      ],
      contradicting_evidence: [
        'Outbound database query to orders-db remained fast (14ms).',
      ],
      affected_paths: [
        'checkout-core -> payment-ledger',
        'api-gateway -> checkout-core -> payment-ledger',
      ],
      recommended_actions: [
        'Halt active chaos experiment exp-9411 to restore steady-state latency.',
        'Inspect payment gateway socket buffer limits and timeout deadlines.',
      ],
    },
    candidates: [
      {
        candidate_id: 'cand-01-pay',
        service_id: 'payment-ledger',
        service_name: 'Payment Ledger',
        node_type: 'app_service',
        score: 88.5,
        confidence: 'HIGH',
        is_primary_cause: true,
        is_collateral_symptom: false,
        factors: [],
        supporting_evidence: [
          'Exclusive span self-duration measured at 842.0ms (94% of total trace latency).',
          'Direct target of active Toxiproxy chaos latency injection exp-9411.',
        ],
        contradicting_evidence: [
          'Outbound database query to orders-db remained fast (14ms).',
        ],
        affected_paths: ['checkout-core -> payment-ledger'],
        recommended_actions: ['Halt active chaos experiment exp-9411.'],
      },
      {
        candidate_id: 'cand-02-chk',
        service_id: 'checkout-core',
        service_name: 'Checkout Core',
        node_type: 'app_service',
        score: 36.4,
        confidence: 'LOW',
        is_primary_cause: false,
        is_collateral_symptom: true,
        factors: [],
        supporting_evidence: [
          'Elevated latency observed at checkout ingress.',
        ],
        contradicting_evidence: [
          'Trace waterfall proves 91% of latency was spent awaiting payment-ledger response.',
          'Exclusive self-duration is only 42ms.',
        ],
        affected_paths: ['api-gateway -> checkout-core'],
        recommended_actions: ['Review circuit breaker fallback timeouts for payment client.'],
      },
      {
        candidate_id: 'cand-03-gw',
        service_id: 'api-gateway',
        service_name: 'API Gateway',
        node_type: 'api_gateway',
        score: 18.2,
        confidence: 'LOW',
        is_primary_cause: false,
        is_collateral_symptom: true,
        factors: [],
        supporting_evidence: ['Ingress proxy returned HTTP 504 Gateway Timeout.'],
        contradicting_evidence: [
          'Ingress gateway internal processing time was normal (11ms).',
          'Purely a perimeter collateral symptom of downstream failure.',
        ],
        affected_paths: ['client -> api-gateway'],
        recommended_actions: ['Verify ingress timeout configuration.'],
      },
    ],
    collateral_symptoms: [
      {
        candidate_id: 'cand-02-chk',
        service_id: 'checkout-core',
        service_name: 'Checkout Core',
        node_type: 'app_service',
        score: 36.4,
        confidence: 'LOW',
        is_primary_cause: false,
        is_collateral_symptom: true,
        factors: [],
        supporting_evidence: ['Elevated latency observed at checkout ingress.'],
        contradicting_evidence: ['Trace waterfall proves latency was spent awaiting payment-ledger.'],
        affected_paths: ['api-gateway -> checkout-core'],
        recommended_actions: ['Review circuit breaker fallback.'],
      },
      {
        candidate_id: 'cand-03-gw',
        service_id: 'api-gateway',
        service_name: 'API Gateway',
        node_type: 'api_gateway',
        score: 18.2,
        confidence: 'LOW',
        is_primary_cause: false,
        is_collateral_symptom: true,
        factors: [],
        supporting_evidence: ['Perimeter HTTP 504 timeouts.'],
        contradicting_evidence: ['Internal processing time was 11ms.'],
        affected_paths: ['client -> api-gateway'],
        recommended_actions: ['Verify ingress timeout.'],
      },
    ],
    propagation_paths: [
      {
        source_service: 'api-gateway',
        target_service: 'payment-ledger',
        hops: 2,
        propagation_delay_ms: 842.0,
        is_critical_path: true,
        path_segments: ['api-gateway', 'checkout-core', 'payment-ledger'],
      },
      {
        source_service: 'checkout-core',
        target_service: 'payment-ledger',
        hops: 1,
        propagation_delay_ms: 842.0,
        is_critical_path: true,
        path_segments: ['checkout-core', 'payment-ledger'],
      },
    ],
    evidence_items: [
      {
        evidence_id: 'ev-01',
        evidence_type: 'TRACE_LATENCY_SPIKE',
        service_id: 'payment-ledger',
        timestamp: new Date().toISOString(),
        details: { span_id: 'sp-04', duration_ms: 842.0, exclusive_duration_ms: 828.0 },
        source_reference: 'jaeger:tr-89f2c4a10e:sp-04',
      },
      {
        evidence_id: 'ev-02',
        evidence_type: 'METRIC_ANOMALY',
        service_id: 'payment-ledger',
        timestamp: new Date().toISOString(),
        details: { p99: 842.0, baseline_p99: 32.0, error_rate: 7.8 },
        source_reference: 'prometheus:m7_evidence_package',
      },
      {
        evidence_id: 'ev-03',
        evidence_type: 'CHAOS_FAULT_INJECTION',
        service_id: 'payment-ledger',
        timestamp: new Date().toISOString(),
        details: { experiment_id: 'exp-9411', fault_type: 'LATENCY_INJECTION', magnitude: 500 },
        source_reference: 'chaos:exp-9411',
      },
    ],
    missing_evidence_warnings: [],
    execution_metadata: {
      algorithm_version: 'v1.0.0-deterministic',
      execution_duration_ms: 4.8,
      evaluated_services_count: 5,
      evaluated_spans_count: 14,
      evaluated_metrics_count: 40,
      telemetry_freshness: 'FRESH',
      evaluated_at: new Date().toISOString(),
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

let mockAnalyses = { ...INITIAL_MOCK_ANALYSES };

export const mockRcaService = {
  reset() {
    mockAnalyses = JSON.parse(JSON.stringify(INITIAL_MOCK_ANALYSES));
  },

  async startRCAAnalysis(incidentId: string, algorithmVersion: string = 'v1.0.0-deterministic'): Promise<RCAAnalysis> {
    const existing = mockAnalyses[incidentId];
    if (existing) return existing;

    const fresh: RCAAnalysis = {
      ...INITIAL_MOCK_ANALYSES['inc-9901-latency-breach'],
      id: `rca-${Date.now()}`,
      incident_id: incidentId,
      execution_metadata: {
        ...INITIAL_MOCK_ANALYSES['inc-9901-latency-breach'].execution_metadata,
        algorithm_version: algorithmVersion,
        evaluated_at: new Date().toISOString(),
      },
    };
    mockAnalyses[incidentId] = fresh;
    return fresh;
  },

  async getLatestRCA(incidentId: string): Promise<RCAAnalysis | null> {
    return mockAnalyses[incidentId] || null;
  },

  async getAnalysis(analysisId: string): Promise<RCAAnalysis> {
    const item = Object.values(mockAnalyses).find((a) => a.id === analysisId);
    if (!item) throw new Error(`RCA Analysis ${analysisId} not found`);
    return item;
  },

  async getCandidates(analysisId: string) {
    const analysis = await this.getAnalysis(analysisId);
    return {
      analysis_id: analysis.id,
      incident_id: analysis.incident_id,
      status: analysis.status,
      algorithm_version: analysis.execution_metadata.algorithm_version,
      candidates: analysis.candidates,
      primary_root_cause: analysis.primary_root_cause,
      collateral_symptoms: analysis.collateral_symptoms,
    };
  },

  async getEvidence(analysisId: string): Promise<RCAEvidence[]> {
    const analysis = await this.getAnalysis(analysisId);
    return analysis.evidence_items;
  },

  async getPropagation(analysisId: string) {
    const analysis = await this.getAnalysis(analysisId);
    return {
      analysis_id: analysis.id,
      incident_id: analysis.incident_id,
      paths: analysis.propagation_paths,
      primary_fault_origin: analysis.primary_root_cause?.service_id || null,
    };
  },

  async rerunAnalysis(analysisId: string, algorithmVersion: string = 'v1.0.0-deterministic'): Promise<RCAAnalysis> {
    const analysis = await this.getAnalysis(analysisId);
    const updated: RCAAnalysis = {
      ...analysis,
      id: `rca-rerun-${Date.now()}`,
      execution_metadata: {
        ...analysis.execution_metadata,
        algorithm_version: algorithmVersion,
        evaluated_at: new Date().toISOString(),
      },
    };
    mockAnalyses[analysis.incident_id] = updated;
    return updated;
  },
};
