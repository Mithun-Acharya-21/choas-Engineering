export type NodeType =
  | 'api_gateway'
  | 'app_service'
  | 'postgres'
  | 'redis'
  | 'external';

export type ProtocolType = 'HTTP' | 'gRPC' | 'AMQP' | 'TCP';
export type DependencyType = 'synchronous' | 'asynchronous';
export type ServiceTier = 'ingress' | 'compute' | 'data';

export interface ResourceLimits {
  cpuRequest: string;
  cpuLimit: string;
  memoryRequest: string;
  memoryLimit: string;
}

export interface HealthCheckConfig {
  path: string;
  port: number;
  initialDelaySeconds: number;
  periodSeconds: number;
}

export interface TopologyNode {
  id: string;
  name: string;
  nodeType: NodeType;
  image: string;
  containerPort: number;
  replicas: number;
  envVars: Record<string, string>;
  resourceLimits: ResourceLimits;
  healthCheck?: HealthCheckConfig;
  position: { x: number; y: number };
  groupId?: string;
  description?: string;
  // Backwards-compatible aliases if needed by legacy views
  tier?: ServiceTier;
  namespace?: string;
  dependencies?: string[];
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  protocol: ProtocolType;
  dependencyType: DependencyType;
  port?: number;
  description?: string;
}

export interface ServiceDependency {
  id: string;
  sourceServiceId: string;
  targetServiceId: string;
  protocol: ProtocolType;
  dependencyType: DependencyType;
}

export interface TopologyGroup {
  id: string;
  name: string;
  color?: string;
}

export interface ServiceTopology {
  id: string;
  tenantId: string;
  projectId: string;
  name: string;
  description?: string;
  version: number;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  groups?: TopologyGroup[];
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  // Legacy aliases
  services?: TopologyNode[];
  dependencies?: any[];
}

export interface TopologyVersionRecord {
  id: string;
  topologyId: string;
  version: number;
  name: string;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  groups: TopologyGroup[];
  createdAt: string;
  createdBy?: string;
}

export interface ValidationErrorDetail {
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface ValidationWarningDetail {
  code: string;
  message: string;
  cycle?: string[];
  nodeId?: string;
}

export interface TopologyValidationResult {
  isValid: boolean;
  errors: ValidationErrorDetail[];
  warnings: ValidationWarningDetail[];
  detectedCycles: string[][];
  nodeCount: number;
  edgeCount: number;
}

export interface TopologyCreatePayload {
  name: string;
  projectId: string;
  description?: string;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  groups?: TopologyGroup[];
}

export interface TopologyUpdatePayload {
  name?: string;
  description?: string;
  expectedVersion: number;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  groups?: TopologyGroup[];
}

export interface TopologyDeployResponse {
  sandboxId: string;
  topologyId: string;
  topologyVersion: number;
  status: string;
  workloadsDeployed: number;
  namespace: string;
  message: string;
  deployedAt: string;
}
