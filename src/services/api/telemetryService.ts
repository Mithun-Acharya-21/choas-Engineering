import {
  DistributedTrace,
  ExperimentTelemetryCorrelation,
  LogEntry,
  ServiceHealthStatus,
  TelemetryPoint,
  TimeRange,
} from '../../types/domain/telemetry';
import { apiClient } from './apiClient';

export interface TelemetryQueryParams {
  sandboxId: string;
  timeRange?: TimeRange;
  serviceId?: string;
  experimentId?: string;
}

export interface TraceQueryParams {
  sandboxId: string;
  serviceId?: string;
  limit?: number;
  hasErrors?: boolean;
  faultInjected?: boolean;
}

export interface LogQueryParams {
  sandboxId: string;
  service?: string;
  level?: string;
  traceId?: string;
  experimentId?: string;
  query?: string;
  limit?: number;
  faultInjected?: boolean;
}

export interface ExperimentCorrelationParams {
  experimentId: string;
  sandboxId: string;
  targetService?: string;
  faultType?: string;
  magnitude?: number;
  unit?: string;
  durationSeconds?: number;
}

export const telemetryService = {
  async getMetrics(params: TelemetryQueryParams): Promise<TelemetryPoint[]> {
    const raw = await apiClient.get<any[]>('/telemetry/metrics', {
      sandbox_id: params.sandboxId,
      time_range: params.timeRange || '15m',
      service_id: params.serviceId,
      experiment_id: params.experimentId,
    });

    if (Array.isArray(raw) && raw.length > 0 && raw[0].points) {
      // Returned as TimeSeriesMetric[]: flatten or map the first matching series points
      const points = raw[0].points;
      return points.map((p: any) => ({
        timestamp: p.timestamp,
        p50: p.p50,
        p95: p.p95,
        p99: p.p99,
        baselineP99: p.baseline_p99,
        rps: p.rps,
        errorRate: p.error_rate,
        cpuUtilizationPct: p.cpu_utilization_pct,
        memoryUtilizationPct: p.memory_utilization_pct,
        activeRequests: p.active_requests,
        faultActive: p.fault_active,
      }));
    }
    return [];
  },

  async getHealth(sandboxId: string, experimentId?: string): Promise<ServiceHealthStatus[]> {
    const raw = await apiClient.get<any[]>('/telemetry/health', {
      sandbox_id: sandboxId,
      experiment_id: experimentId,
    });
    return (raw || []).map((s: any) => ({
      serviceId: s.service_id,
      name: s.name,
      namespace: s.namespace,
      cluster: s.cluster,
      status: s.status,
      replicasDesired: s.replicas_desired,
      replicasReady: s.replicas_ready,
      restartsTotal: s.restarts_total,
      p99Ms: s.p99_ms,
      rps: s.rps,
      errorRatePct: s.error_rate_pct,
      sloBudgetRemainingPct: s.slo_budget_remaining_pct,
      toxiproxyActive: s.toxiproxy_active,
    }));
  },

  async getTraces(params: TraceQueryParams): Promise<DistributedTrace[]> {
    const raw = await apiClient.get<any[]>('/telemetry/traces', {
      sandbox_id: params.sandboxId,
      service_id: params.serviceId,
      limit: params.limit || 10,
      has_errors: params.hasErrors,
      fault_injected: params.faultInjected,
    });
    return (raw || []).map((t: any) => ({
      traceId: t.trace_id,
      rootService: t.root_service,
      rootOperation: t.root_operation,
      timestamp: t.timestamp,
      durationMs: t.duration_ms,
      spansCount: t.spans_count,
      hasErrors: t.has_errors,
      spans: (t.spans || []).map((sp: any) => ({
        id: sp.id,
        traceId: sp.trace_id,
        parentSpanId: sp.parent_span_id,
        service: sp.service,
        operation: sp.operation,
        startOffsetMs: sp.start_offset_ms,
        durationMs: sp.duration_ms,
        status: sp.status,
        statusCode: sp.status_code,
        tags: sp.tags,
      })),
    }));
  },

  async getTraceById(traceId: string, sandboxId: string): Promise<DistributedTrace> {
    const t = await apiClient.get<any>(`/telemetry/traces/${traceId}`, {
      sandbox_id: sandboxId,
    });
    return {
      traceId: t.trace_id,
      rootService: t.root_service,
      rootOperation: t.root_operation,
      timestamp: t.timestamp,
      durationMs: t.duration_ms,
      spansCount: t.spans_count,
      hasErrors: t.has_errors,
      spans: (t.spans || []).map((sp: any) => ({
        id: sp.id,
        traceId: sp.trace_id,
        parentSpanId: sp.parent_span_id,
        service: sp.service,
        operation: sp.operation,
        startOffsetMs: sp.start_offset_ms,
        durationMs: sp.duration_ms,
        status: sp.status,
        statusCode: sp.status_code,
        tags: sp.tags,
      })),
    };
  },

  async getLogs(params: LogQueryParams): Promise<LogEntry[]> {
    const raw = await apiClient.get<any[]>('/telemetry/logs', {
      sandbox_id: params.sandboxId,
      service: params.service,
      level: params.level,
      trace_id: params.traceId,
      experiment_id: params.experimentId,
      query: params.query,
      limit: params.limit || 50,
      fault_injected: params.faultInjected,
    });
    return (raw || []).map((l: any) => ({
      id: l.id,
      timestampIso: l.timestamp_iso,
      level: l.level,
      service: l.service,
      sandboxId: l.sandbox_id,
      cluster: l.cluster,
      traceId: l.trace_id,
      spanId: l.span_id,
      experimentId: l.experiment_id,
      durationMs: l.duration_ms,
      message: l.message,
      metadata: l.metadata || {},
      spans: (l.spans || []).map((sp: any) => ({
        id: sp.id,
        traceId: sp.trace_id,
        parentSpanId: sp.parent_span_id,
        service: sp.service,
        operation: sp.operation,
        startOffsetMs: sp.start_offset_ms,
        durationMs: sp.duration_ms,
        status: sp.status,
        statusCode: sp.status_code,
        tags: sp.tags,
      })),
    }));
  },

  async getExperimentCorrelation(params: ExperimentCorrelationParams): Promise<ExperimentTelemetryCorrelation> {
    const raw = await apiClient.get<any>(`/telemetry/experiments/${params.experimentId}`, {
      sandbox_id: params.sandboxId,
      target_service: params.targetService || 'payment-service',
      fault_type: params.faultType || 'latency',
      magnitude: params.magnitude || 2000.0,
      unit: params.unit || 'ms',
      duration_seconds: params.durationSeconds || 60,
    });

    const mapSummary = (s: any) => ({
      phase: s.phase,
      startTime: s.start_time,
      endTime: s.end_time,
      sampleCount: s.sample_count,
      avgP50Ms: s.avg_p50_ms,
      avgP95Ms: s.avg_p95_ms,
      avgP99Ms: s.avg_p99_ms,
      avgRps: s.avg_rps,
      avgErrorRatePct: s.avg_error_rate_pct,
      cpuUtilizationPct: s.cpu_utilization_pct,
      memoryUtilizationPct: s.memory_utilization_pct,
    });

    return {
      experimentId: raw.experiment_id,
      sandboxId: raw.sandbox_id,
      targetService: raw.target_service,
      faultType: raw.fault_type,
      faultMagnitude: raw.fault_magnitude,
      faultUnit: raw.fault_unit,
      startedAt: raw.started_at,
      completedAt: raw.completed_at,
      baseline: mapSummary(raw.baseline),
      faultActive: mapSummary(raw.fault_active),
      recovery: mapSummary(raw.recovery),
      impactDeltaP99Pct: raw.impact_delta_p99_pct,
      recovered: raw.recovered,
      correlatedTraces: (raw.correlated_traces || []).map((t: any) => ({
        traceId: t.trace_id,
        rootService: t.root_service,
        rootOperation: t.root_operation,
        timestamp: t.timestamp,
        durationMs: t.duration_ms,
        spansCount: t.spans_count,
        hasErrors: t.has_errors,
        spans: (t.spans || []).map((sp: any) => ({
          id: sp.id,
          traceId: sp.trace_id,
          parentSpanId: sp.parent_span_id,
          service: sp.service,
          operation: sp.operation,
          startOffsetMs: sp.start_offset_ms,
          durationMs: sp.duration_ms,
          status: sp.status,
          statusCode: sp.status_code,
          tags: sp.tags,
        })),
      })),
      correlatedLogs: (raw.correlated_logs || []).map((l: any) => ({
        id: l.id,
        timestampIso: l.timestamp_iso,
        level: l.level,
        service: l.service,
        sandboxId: l.sandbox_id,
        cluster: l.cluster,
        traceId: l.trace_id,
        spanId: l.span_id,
        experimentId: l.experiment_id,
        durationMs: l.duration_ms,
        message: l.message,
        metadata: l.metadata || {},
        spans: [],
      })),
    };
  },
};
