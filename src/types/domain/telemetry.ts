export type TimeRange = '15m' | '1h' | '6h' | '24h';
export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'CRIT' | 'CRITICAL';

export interface TelemetryPoint {
  timestamp: string;
  p50: number;
  p95: number;
  p99: number;
  baselineP99: number;
  rps: number;
  errorRate: number;
  cpuUtilizationPct?: number;
  memoryUtilizationPct?: number;
  activeRequests?: number;
  faultActive: boolean;
}

export interface MetricSeriesQuery {
  sandboxId: string;
  serviceId?: string;
  timeRange: TimeRange;
  experimentId?: string;
}

export interface TraceSpan {
  id: string;
  traceId?: string;
  parentSpanId?: string | null;
  service: string;
  operation: string;
  startOffsetMs: number;
  durationMs: number;
  status: 'ok' | 'degraded' | 'error';
  statusCode?: number;
  tags?: Record<string, string>;
}

export interface DistributedTrace {
  traceId: string;
  rootService: string;
  rootOperation: string;
  timestamp: string;
  durationMs: number;
  spansCount: number;
  hasErrors: boolean;
  spans: TraceSpan[];
}

export interface LogEntry {
  id: string;
  timestampIso: string;
  level: LogLevel;
  service: string;
  sandboxId?: string;
  cluster: string;
  traceId: string;
  spanId?: string;
  experimentId?: string;
  durationMs: number;
  message: string;
  metadata: Record<string, string | number>;
  spans: TraceSpan[];
}

export interface ServiceHealthStatus {
  serviceId: string;
  name: string;
  namespace: string;
  cluster: string;
  status: 'healthy' | 'degraded' | 'critical';
  replicasDesired: number;
  replicasReady: number;
  restartsTotal: number;
  p99Ms: number;
  rps: number;
  errorRatePct: number;
  sloBudgetRemainingPct: number;
  toxiproxyActive: boolean;
}

export interface TelemetryWindowSummary {
  phase: 'baseline' | 'fault_active' | 'recovery';
  startTime: string;
  endTime: string;
  sampleCount: number;
  avgP50Ms: number;
  avgP95Ms: number;
  avgP99Ms: number;
  avgRps: number;
  avgErrorRatePct: number;
  cpuUtilizationPct: number;
  memoryUtilizationPct: number;
}

export interface ExperimentTelemetryCorrelation {
  experimentId: string;
  sandboxId: string;
  targetService: string;
  faultType: string;
  faultMagnitude: number;
  faultUnit: string;
  startedAt: string;
  completedAt?: string;
  baseline: TelemetryWindowSummary;
  faultActive: TelemetryWindowSummary;
  recovery: TelemetryWindowSummary;
  impactDeltaP99Pct: number;
  recovered: boolean;
  correlatedTraces: DistributedTrace[];
  correlatedLogs: LogEntry[];
}
