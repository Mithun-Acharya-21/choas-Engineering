export type SandboxStatus =
  | 'PENDING'
  | 'PROVISIONING'
  | 'READY'
  | 'FAILED'
  | 'TERMINATING'
  | 'TERMINATED'
  | 'DELETED';

export interface ContainerStatus {
  name: string;
  ready: boolean;
  restartCount: number;
  image: string;
}

export interface K8sPod {
  name: string;
  namespace: string;
  status: 'Running' | 'Pending' | 'Failed' | 'CrashLoopBackOff' | 'Terminating';
  readyContainers: string; // e.g. "2/2"
  restartCount: number;
  toxiproxyActive: boolean;
  ip?: string;
  nodeName?: string;
  containers: ContainerStatus[];
}

export interface K8sWorkload {
  name: string;
  namespace: string;
  replicasDesired: number;
  replicasReady: number;
  image: string;
  containerPort: number;
  endpoint: string;
  toxiproxyPort: number;
  pods: K8sPod[];
}

export interface SandboxResourceQuota {
  cpuRequest: string;
  cpuLimit: string;
  memoryRequest: string;
  memoryLimit: string;
  maxPods: number;
}

export interface SandboxResourceProfile {
  profileName: 'standard' | 'stress_lab' | 'custom';
  cpuRequest: string;
  cpuLimit: string;
  memoryRequest: string;
  memoryLimit: string;
  maxPods: number;
}

export interface Sandbox {
  id: string;
  tenantId: string;
  projectId: string;
  name?: string;
  topologyId: string;
  k8sNamespace: string;
  clusterId?: string;
  status: SandboxStatus;
  workloads: K8sWorkload[];
  quota?: SandboxResourceQuota;
  resourceProfile?: SandboxResourceProfile;
  isIsolated: boolean; // default-deny NetworkPolicy verified
  errorSummary?: string;
  progressPercentage?: number;
  currentStep?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SandboxCreatePayload {
  name: string;
  projectId: string;
  clusterId?: string;
  topologyId?: string;
  resourceProfile?: {
    profile_name?: string;
    cpu_request?: string;
    cpu_limit?: string;
    memory_request?: string;
    memory_limit?: string;
    max_pods?: number;
  };
  ttlHours?: number;
}

export interface SandboxStatusResponse {
  id: string;
  status: SandboxStatus;
  k8s_namespace: string;
  cluster_id: string;
  progress_percentage: number;
  current_step: string;
  workloads_ready: number;
  workloads_total: number;
  error_summary?: string;
  updated_at: string;
}
