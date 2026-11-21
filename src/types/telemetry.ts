export type ScreenId = 'telemetry' | 'chaos' | 'topology' | 'logs' | 'settings';

export type ClusterId =
  | 'sandbox-alpha-us-east-1'
  | 'sandbox-beta-eu-central-1'
  | 'sandbox-dev-local-kind';

export type TimeRange = '15m' | '1h' | '6h' | '24h';

export type ServiceStatus = 'healthy' | 'injecting' | 'critical';

export type FaultType =
  | 'latency'
  | 'packet_loss'
  | 'cpu_pressure'
  | 'pod_kill'
  | 'dns_blackhole';

export type LogLevel = 'INFO' | 'WARN' | 'CRIT';

export interface ServiceNode {
  id: string;
  name: string;
  namespace: string;
  cluster: ClusterId;
  tier: 'ingress' | 'compute' | 'data';
  status: ServiceStatus;
  rps: number;
  baseRps: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  baseP99Ms: number;
  errorRatePct: number;
  baseErrorRatePct: number;
  cpuPct: number;
  memoryPct: number;
  sloBudgetRemainingPct: number;
  podsReady: number;
  podsTotal: number;
  version: string;
  cidr: string;
  position: { x: number; y: number };
  dependencies: string[];
  isControlPlane?: boolean;
}

export interface ChaosExperiment {
  id: string;
  name: string;
  targetServiceId: string;
  targetServiceName: string;
  targetNamespace?: string;
  cluster: ClusterId;
  faultType: FaultType;
  magnitude: number;
  magnitudeUnit: string;
  blastRadiusPct: number;
  durationSec: number;
  remainingSec: number;
  status: 'running' | 'completed' | 'halted';
  startedAt: string;
  hypothesis: string;
  impactDeltaP99Pct: number;
}

export interface TelemetryPoint {
  timestamp: string;
  p50: number;
  p95: number;
  p99: number;
  baselineP99: number;
  rps: number;
  errorRate: number;
  faultActive: boolean;
}

export interface TraceSpan {
  id: string;
  service: string;
  operation: string;
  startOffsetMs: number;
  durationMs: number;
  status: 'ok' | 'degraded' | 'error';
  tags: Record<string, string>;
}

export interface LogEntry {
  id: string;
  timestampIso: string;
  level: LogLevel;
  service: string;
  cluster: ClusterId;
  traceId: string;
  durationMs: number;
  message: string;
  metadata: Record<string, string | number>;
  spans: TraceSpan[];
}
