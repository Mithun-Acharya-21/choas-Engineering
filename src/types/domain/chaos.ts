export type FaultType =
  | 'latency'
  | 'packet_loss'
  | 'cpu_pressure'
  | 'pod_kill'
  | 'dns_blackhole'
  | 'bandwidth_limit';

export type ExperimentStatus = 'pending' | 'running' | 'completed' | 'halted' | 'failed';

export interface ToxicConfig {
  name: string;
  type: FaultType;
  stream: 'downstream' | 'upstream';
  toxicity: number; // 0.0 to 1.0
  attributes: {
    latency?: number; // ms
    jitter?: number; // ms
    rate?: number; // KB/s
    packetLossPct?: number;
  };
}

export interface ChaosSafetyValidation {
  isSandboxTarget: boolean;
  isControlPlaneProtected: boolean;
  isNamespaceAllowed: boolean;
  warnings: string[];
  errors: string[];
}

export interface ChaosExperiment {
  id: string;
  tenantId: string;
  projectId: string;
  name: string;
  description?: string;
  targetServiceId: string;
  targetServiceName: string;
  targetNamespace: string;
  sandboxId: string;
  faultType: FaultType;
  magnitude: number;
  magnitudeUnit: string;
  blastRadiusPct: number;
  durationSec: number;
  remainingSec: number;
  status: ExperimentStatus;
  startedAt?: string;
  completedAt?: string;
  hypothesis: string;
  impactDeltaP99Pct: number;
  failureReason?: string;
}

export interface ExperimentRun {
  id: string;
  tenantId: string;
  experimentId: string;
  sandboxId: string;
  triggeredByUserId?: string;
  status: ExperimentStatus;
  startedAt: string;
  completedAt?: string;
  failureReason?: string;
  telemetrySnapshot?: Record<string, unknown>;
}
