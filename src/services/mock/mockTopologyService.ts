import {
  ServiceTopology,
  TopologyCreatePayload,
  TopologyDeployResponse,
  TopologyEdge,
  TopologyNode,
  TopologyUpdatePayload,
  TopologyValidationResult,
  TopologyVersionRecord,
  ValidationErrorDetail,
  ValidationWarningDetail,
} from '../../types/domain/topology';
import { mockSandboxService } from './mockSandboxService';

const DEFAULT_ECOMMERCE_NODES: TopologyNode[] = [
  {
    id: 'api-gateway',
    name: 'API Gateway',
    nodeType: 'api_gateway',
    image: 'chaosengine/api-gateway:1.0.0',
    containerPort: 8081,
    replicas: 1,
    envVars: { LOG_LEVEL: 'info', RATE_LIMIT_RPS: '100' },
    resourceLimits: { cpuRequest: '100m', cpuLimit: '500m', memoryRequest: '128Mi', memoryLimit: '512Mi' },
    healthCheck: { path: '/health', port: 8081, initialDelaySeconds: 5, periodSeconds: 10 },
    position: { x: 50, y: 180 },
    groupId: 'grp-ingress',
    description: 'Central API ingress gateway routing public requests to checkout microservices.',
  },
  {
    id: 'order-service',
    name: 'Order Service',
    nodeType: 'app_service',
    image: 'chaosengine/order-service:1.0.0',
    containerPort: 8081,
    replicas: 2,
    envVars: { DB_MAX_CONNS: '20', TIMEOUT_MS: '2000' },
    resourceLimits: { cpuRequest: '200m', cpuLimit: '1000m', memoryRequest: '256Mi', memoryLimit: '1024Mi' },
    healthCheck: { path: '/health', port: 8081, initialDelaySeconds: 5, periodSeconds: 10 },
    position: { x: 340, y: 100 },
    groupId: 'grp-core',
    description: 'Manages shopping baskets, order fulfillment workflows, and transactional state.',
  },
  {
    id: 'payment-service',
    name: 'Payment Service',
    nodeType: 'app_service',
    image: 'chaosengine/payment-service:1.0.0',
    containerPort: 8081,
    replicas: 1,
    envVars: { PSP_RETRY_COUNT: '3', CURRENCY: 'USD' },
    resourceLimits: { cpuRequest: '150m', cpuLimit: '800m', memoryRequest: '256Mi', memoryLimit: '512Mi' },
    healthCheck: { path: '/health', port: 8081, initialDelaySeconds: 5, periodSeconds: 10 },
    position: { x: 620, y: 60 },
    groupId: 'grp-core',
    description: 'Authorizes credit card transactions, fraud checks, and 3DS secure settlement.',
  },
  {
    id: 'inventory-service',
    name: 'Inventory Service',
    nodeType: 'app_service',
    image: 'chaosengine/inventory-service:1.0.0',
    containerPort: 8081,
    replicas: 1,
    envVars: { LOW_STOCK_THRESHOLD: '5' },
    resourceLimits: { cpuRequest: '100m', cpuLimit: '500m', memoryRequest: '128Mi', memoryLimit: '512Mi' },
    healthCheck: { path: '/health', port: 8081, initialDelaySeconds: 5, periodSeconds: 10 },
    position: { x: 620, y: 220 },
    groupId: 'grp-core',
    description: 'Maintains stock levels, reserve holds, and warehouse allocation queues.',
  },
  {
    id: 'orders-db',
    name: 'Orders PostgreSQL',
    nodeType: 'postgres',
    image: 'postgres:16-alpine',
    containerPort: 5432,
    replicas: 1,
    envVars: { POSTGRES_DB: 'orders_db' },
    resourceLimits: { cpuRequest: '250m', cpuLimit: '1000m', memoryRequest: '512Mi', memoryLimit: '2048Mi' },
    position: { x: 340, y: 320 },
    groupId: 'grp-data',
    description: 'Primary ACID relational datastore for order entity records.',
  },
  {
    id: 'redis-cache',
    name: 'Session Redis',
    nodeType: 'redis',
    image: 'redis:7.2-alpine',
    containerPort: 6379,
    replicas: 1,
    envVars: { MAXMEMORY_POLICY: 'allkeys-lru' },
    resourceLimits: { cpuRequest: '100m', cpuLimit: '400m', memoryRequest: '128Mi', memoryLimit: '512Mi' },
    position: { x: 620, y: 360 },
    groupId: 'grp-data',
    description: 'Distributed in-memory key-value cache for basket locks and idempotency keys.',
  },
  {
    id: 'stripe-psp',
    name: 'Stripe PSP Gateway',
    nodeType: 'external',
    image: 'chaosengine/external-mock:1.0.0',
    containerPort: 443,
    replicas: 1,
    envVars: { API_HOST: 'api.stripe.com' },
    resourceLimits: { cpuRequest: '50m', cpuLimit: '100m', memoryRequest: '64Mi', memoryLimit: '128Mi' },
    position: { x: 920, y: 60 },
    description: 'Third-party Payment Service Provider cloud endpoint for credit card clearing.',
  },
];

const DEFAULT_ECOMMERCE_EDGES: TopologyEdge[] = [
  { id: 'edge-gw-order', source: 'api-gateway', target: 'order-service', protocol: 'HTTP', dependencyType: 'synchronous' },
  { id: 'edge-order-pay', source: 'order-service', target: 'payment-service', protocol: 'HTTP', dependencyType: 'synchronous' },
  { id: 'edge-order-inv', source: 'order-service', target: 'inventory-service', protocol: 'HTTP', dependencyType: 'synchronous' },
  { id: 'edge-order-db', source: 'order-service', target: 'orders-db', protocol: 'TCP', dependencyType: 'synchronous', port: 5432 },
  { id: 'edge-order-redis', source: 'order-service', target: 'redis-cache', protocol: 'TCP', dependencyType: 'synchronous', port: 6379 },
  { id: 'edge-pay-psp', source: 'payment-service', target: 'stripe-psp', protocol: 'HTTP', dependencyType: 'synchronous', port: 443 },
];

let mockTopologies: ServiceTopology[] = [
  {
    id: 'topo-ecommerce-default',
    tenantId: 'c1f7b0f6-9304-4c57-897e-d309085ec617',
    projectId: '550e8400-e29b-41d4-a716-446655440000',
    name: 'E-Commerce Microservices Architecture',
    description: 'Production-like 7-node microservice mesh with API Gateway, databases, cache, and external PSP.',
    version: 1,
    nodes: [...DEFAULT_ECOMMERCE_NODES],
    edges: [...DEFAULT_ECOMMERCE_EDGES],
    groups: [
      { id: 'grp-ingress', name: 'Ingress Tier', color: '#06b6d4' },
      { id: 'grp-core', name: 'Application Microservices', color: '#6366f1' },
      { id: 'grp-data', name: 'Data Persistence Tier', color: '#3b82f6' },
    ],
    createdAt: new Date(Date.now() - 3600 * 48 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 24 * 1000).toISOString(),
  },
];

let mockVersions: Record<string, TopologyVersionRecord[]> = {
  'topo-ecommerce-default': [
    {
      id: 'ver-snap-001',
      topologyId: 'topo-ecommerce-default',
      version: 1,
      name: 'E-Commerce Microservices Architecture',
      nodes: [...DEFAULT_ECOMMERCE_NODES],
      edges: [...DEFAULT_ECOMMERCE_EDGES],
      groups: [
        { id: 'grp-ingress', name: 'Ingress Tier', color: '#06b6d4' },
        { id: 'grp-core', name: 'Application Microservices', color: '#6366f1' },
        { id: 'grp-data', name: 'Data Persistence Tier', color: '#3b82f6' },
      ],
      createdAt: new Date(Date.now() - 3600 * 48 * 1000).toISOString(),
    },
  ],
};

export const mockTopologyService = {
  async listTopologies(projectId?: string): Promise<ServiceTopology[]> {
    await new Promise((r) => setTimeout(r, 80));
    if (projectId) {
      return mockTopologies.filter((t) => t.projectId === projectId);
    }
    return [...mockTopologies];
  },

  async getTopology(id: string): Promise<ServiceTopology> {
    await new Promise((r) => setTimeout(r, 60));
    const item = mockTopologies.find((t) => t.id === id);
    if (!item) throw new Error(`Topology with ID ${id} not found`);
    return { ...item, nodes: [...item.nodes], edges: [...item.edges] };
  },

  async createTopology(payload: TopologyCreatePayload): Promise<ServiceTopology> {
    await new Promise((r) => setTimeout(r, 120));
    const newId = `topo-${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

    const record: ServiceTopology = {
      id: newId,
      tenantId: 'c1f7b0f6-9304-4c57-897e-d309085ec617',
      projectId: payload.projectId,
      name: payload.name,
      description: payload.description,
      version: 1,
      nodes: [...payload.nodes],
      edges: [...payload.edges],
      groups: payload.groups || [],
      createdAt: now,
      updatedAt: now,
    };

    mockTopologies.unshift(record);
    mockVersions[newId] = [
      {
        id: `ver-${Math.random().toString(36).substring(2, 9)}`,
        topologyId: newId,
        version: 1,
        name: record.name,
        nodes: [...record.nodes],
        edges: [...record.edges],
        groups: record.groups || [],
        createdAt: now,
      },
    ];

    return { ...record };
  },

  async updateTopology(id: string, payload: TopologyUpdatePayload): Promise<ServiceTopology> {
    await new Promise((r) => setTimeout(r, 120));
    const target = mockTopologies.find((t) => t.id === id);
    if (!target) throw new Error(`Topology with ID ${id} not found`);

    if (target.version !== payload.expectedVersion) {
      throw new Error(
        `Version conflict: current topology version is ${target.version}, but update expected version ${payload.expectedVersion}. Please reload.`
      );
    }

    const newVersion = target.version + 1;
    const now = new Date().toISOString();

    if (payload.name) target.name = payload.name;
    if (payload.description !== undefined) target.description = payload.description;
    target.nodes = [...payload.nodes];
    target.edges = [...payload.edges];
    if (payload.groups) target.groups = [...payload.groups];
    target.version = newVersion;
    target.updatedAt = now;

    if (!mockVersions[id]) mockVersions[id] = [];
    mockVersions[id].unshift({
      id: `ver-${Math.random().toString(36).substring(2, 9)}`,
      topologyId: id,
      version: newVersion,
      name: target.name,
      nodes: [...target.nodes],
      edges: [...target.edges],
      groups: target.groups || [],
      createdAt: now,
    });

    return { ...target };
  },

  async validateTopology(nodes: TopologyNode[], edges: TopologyEdge[]): Promise<TopologyValidationResult> {
    await new Promise((r) => setTimeout(r, 50));
    const errors: ValidationErrorDetail[] = [];
    const warnings: ValidationWarningDetail[] = [];
    const detectedCycles: string[][] = [];

    const nodeIds = new Set(nodes.map((n) => n.id));

    // Check duplicate node IDs
    const seenIds = new Set<string>();
    nodes.forEach((n) => {
      if (seenIds.has(n.id)) {
        errors.push({ code: 'DUPLICATE_NODE_ID', message: `Duplicate node ID '${n.id}' detected.`, nodeId: n.id });
      }
      seenIds.add(n.id);

      // Check approved image
      const isApproved =
        n.image.startsWith('chaosengine/') ||
        n.image.startsWith('postgres:') ||
        n.image.startsWith('redis:') ||
        n.image.startsWith('nginx:') ||
        n.nodeType === 'external';
      if (!isApproved) {
        errors.push({
          code: 'UNAPPROVED_CONTAINER_IMAGE',
          message: `Image '${n.image}' is not permitted in sandbox topologies.`,
          nodeId: n.id,
        });
      }

      // Check ports
      if (n.containerPort < 1 || n.containerPort > 65535) {
        errors.push({ code: 'INVALID_PORT', message: `Container port ${n.containerPort} is invalid.`, nodeId: n.id });
      }
    });

    // Check edges
    const seenEdges = new Set<string>();
    const adj: Record<string, string[]> = {};
    nodes.forEach((n) => (adj[n.id] = []));

    edges.forEach((e) => {
      if (!nodeIds.has(e.source)) {
        errors.push({ code: 'UNKNOWN_SOURCE_NODE', message: `Edge references non-existent source node '${e.source}'`, edgeId: e.id });
      }
      if (!nodeIds.has(e.target)) {
        errors.push({ code: 'UNKNOWN_TARGET_NODE', message: `Edge references non-existent target node '${e.target}'`, edgeId: e.id });
      }
      if (e.source === e.target) {
        errors.push({ code: 'SELF_DEPENDENCY_PROHIBITED', message: `Node '${e.source}' cannot connect to itself.`, edgeId: e.id });
      }
      const edgeKey = `${e.source}->${e.target}`;
      if (seenEdges.has(edgeKey)) {
        errors.push({ code: 'DUPLICATE_EDGE', message: `Duplicate edge from '${e.source}' to '${e.target}'`, edgeId: e.id });
      }
      seenEdges.add(edgeKey);
      if (adj[e.source]) adj[e.source].push(e.target);
    });

    // Detect simple cycles
    const visited: Record<string, number> = {};
    const path: string[] = [];
    const findCycles = (curr: string) => {
      visited[curr] = 1;
      path.push(curr);
      for (const nxt of adj[curr] || []) {
        if (visited[nxt] === 1) {
          const cycleNodes = path.slice(path.indexOf(nxt));
          detectedCycles.push(cycleNodes);
          warnings.push({
            code: 'CYCLIC_DEPENDENCY_DETECTED',
            message: `Cyclic dependency detected: [${cycleNodes.join(' -> ')} -> ${nxt}]. Ensure asynchronous queues or circuit breakers are configured.`,
            cycle: cycleNodes,
          });
        } else if (!visited[nxt]) {
          findCycles(nxt);
        }
      }
      path.pop();
      visited[curr] = 2;
    };
    nodes.forEach((n) => {
      if (!visited[n.id]) findCycles(n.id);
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      detectedCycles,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    };
  },

  async getTopologyVersions(id: string): Promise<TopologyVersionRecord[]> {
    await new Promise((r) => setTimeout(r, 60));
    return mockVersions[id] ? [...mockVersions[id]] : [];
  },

  async revertTopologyVersion(id: string, targetVersion: number): Promise<ServiceTopology> {
    await new Promise((r) => setTimeout(r, 100));
    const versions = mockVersions[id] || [];
    const targetSnapshot = versions.find((v) => v.version === targetVersion);
    if (!targetSnapshot) throw new Error(`Version ${targetVersion} not found`);

    return this.updateTopology(id, {
      expectedVersion: targetSnapshot.version,
      nodes: [...targetSnapshot.nodes],
      edges: [...targetSnapshot.edges],
      groups: [...targetSnapshot.groups],
    });
  },

  async deployTopology(topologyId: string, sandboxId: string): Promise<TopologyDeployResponse> {
    await new Promise((r) => setTimeout(r, 300));
    const top = await this.getTopology(topologyId);
    const sbx = await mockSandboxService.getSandbox(sandboxId);

    if (sbx.status !== 'READY') {
      throw new Error(`Cannot deploy to sandbox in '${sbx.status}' state. Sandbox must be READY.`);
    }

    return {
      sandboxId,
      topologyId,
      topologyVersion: top.version,
      status: 'DEPLOYED',
      workloadsDeployed: top.nodes.filter((n) => n.nodeType !== 'external').length,
      namespace: sbx.k8sNamespace,
      message: `Topology '${top.name}' (v${top.version}) successfully deployed to sandbox ${sandboxId}.`,
      deployedAt: new Date().toISOString(),
    };
  },
};
