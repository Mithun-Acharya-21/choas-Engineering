import { Sandbox, SandboxCreatePayload, SandboxStatusResponse, K8sWorkload } from '../../types/domain/sandbox';

const DEFAULT_SAMPLE_WORKLOADS: K8sWorkload[] = [
  {
    name: 'api-gateway',
    namespace: 'sandbox-ns',
    replicasDesired: 1,
    replicasReady: 1,
    image: 'chaosengine/api-gateway:1.0.0',
    containerPort: 8081,
    endpoint: 'api-gateway.sandbox.svc.cluster.local:8080',
    toxiproxyPort: 8080,
    pods: [
      {
        name: 'api-gateway-7b9f84bc8-xk92m',
        namespace: 'sandbox-ns',
        status: 'Running',
        readyContainers: '2/2',
        restartCount: 0,
        toxiproxyActive: true,
        containers: [
          { name: 'app', ready: true, restartCount: 0, image: 'chaosengine/api-gateway:1.0.0' },
          { name: 'toxiproxy-sidecar', ready: true, restartCount: 0, image: 'ghcr.io/shopify/toxiproxy:2.9.0' },
        ],
      },
    ],
  },
  {
    name: 'order-service',
    namespace: 'sandbox-ns',
    replicasDesired: 1,
    replicasReady: 1,
    image: 'chaosengine/order-service:1.0.0',
    containerPort: 8081,
    endpoint: 'order-service.sandbox.svc.cluster.local:8080',
    toxiproxyPort: 8080,
    pods: [
      {
        name: 'order-service-65cfbb98b-q7ln4',
        namespace: 'sandbox-ns',
        status: 'Running',
        readyContainers: '2/2',
        restartCount: 0,
        toxiproxyActive: true,
        containers: [
          { name: 'app', ready: true, restartCount: 0, image: 'chaosengine/order-service:1.0.0' },
          { name: 'toxiproxy-sidecar', ready: true, restartCount: 0, image: 'ghcr.io/shopify/toxiproxy:2.9.0' },
        ],
      },
    ],
  },
  {
    name: 'payment-service',
    namespace: 'sandbox-ns',
    replicasDesired: 1,
    replicasReady: 1,
    image: 'chaosengine/payment-service:1.0.0',
    containerPort: 8081,
    endpoint: 'payment-service.sandbox.svc.cluster.local:8080',
    toxiproxyPort: 8080,
    pods: [
      {
        name: 'payment-service-58d9fc689d-2zv9w',
        namespace: 'sandbox-ns',
        status: 'Running',
        readyContainers: '2/2',
        restartCount: 0,
        toxiproxyActive: true,
        containers: [
          { name: 'app', ready: true, restartCount: 0, image: 'chaosengine/payment-service:1.0.0' },
          { name: 'toxiproxy-sidecar', ready: true, restartCount: 0, image: 'ghcr.io/shopify/toxiproxy:2.9.0' },
        ],
      },
    ],
  },
  {
    name: 'inventory-service',
    namespace: 'sandbox-ns',
    replicasDesired: 1,
    replicasReady: 1,
    image: 'chaosengine/inventory-service:1.0.0',
    containerPort: 8081,
    endpoint: 'inventory-service.sandbox.svc.cluster.local:8080',
    toxiproxyPort: 8080,
    pods: [
      {
        name: 'inventory-service-846dc4cbbf-p6kmj',
        namespace: 'sandbox-ns',
        status: 'Running',
        readyContainers: '2/2',
        restartCount: 0,
        toxiproxyActive: true,
        containers: [
          { name: 'app', ready: true, restartCount: 0, image: 'chaosengine/inventory-service:1.0.0' },
          { name: 'toxiproxy-sidecar', ready: true, restartCount: 0, image: 'ghcr.io/shopify/toxiproxy:2.9.0' },
        ],
      },
    ],
  },
];

let mockSandboxes: Sandbox[] = [
  {
    id: 'sbx-demo-e-comm-01',
    tenantId: 'c1f7b0f6-9304-4c57-897e-d309085ec617',
    projectId: '550e8400-e29b-41d4-a716-446655440000',
    name: 'E-Commerce Chaos Lab Alpha',
    topologyId: 'topo-microservices-default',
    k8sNamespace: 'sandbox-default-demo-01',
    clusterId: 'sandbox-alpha-us-east-1',
    status: 'READY',
    workloads: DEFAULT_SAMPLE_WORKLOADS.map((w) => ({
      ...w,
      namespace: 'sandbox-default-demo-01',
      pods: w.pods.map((p) => ({ ...p, namespace: 'sandbox-default-demo-01' })),
    })),
    quota: {
      cpuRequest: '2',
      cpuLimit: '4',
      memoryRequest: '4Gi',
      memoryLimit: '8Gi',
      maxPods: 20,
    },
    resourceProfile: {
      profileName: 'standard',
      cpuRequest: '2',
      cpuLimit: '4',
      memoryRequest: '4Gi',
      memoryLimit: '8Gi',
      maxPods: 20,
    },
    isIsolated: true,
    progressPercentage: 100,
    currentStep: 'All workloads ready and verified',
    expiresAt: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
  },
];

export const mockSandboxService = {
  async listSandboxes(projectId?: string): Promise<Sandbox[]> {
    await new Promise((r) => setTimeout(r, 100));
    if (projectId) {
      return mockSandboxes.filter((s) => s.projectId === projectId);
    }
    return [...mockSandboxes];
  },

  async getSandbox(id: string): Promise<Sandbox> {
    await new Promise((r) => setTimeout(r, 80));
    const sbx = mockSandboxes.find((s) => s.id === id);
    if (!sbx) throw new Error(`Sandbox with ID ${id} not found`);
    return { ...sbx };
  },

  async getSandboxStatus(id: string): Promise<SandboxStatusResponse> {
    await new Promise((r) => setTimeout(r, 60));
    const sbx = mockSandboxes.find((s) => s.id === id);
    if (!sbx) throw new Error(`Sandbox with ID ${id} not found`);
    return {
      id: sbx.id,
      status: sbx.status,
      k8s_namespace: sbx.k8sNamespace,
      cluster_id: sbx.clusterId || 'sandbox-alpha-us-east-1',
      progress_percentage: sbx.progressPercentage ?? (sbx.status === 'READY' ? 100 : 40),
      current_step: sbx.currentStep ?? 'Operational',
      workloads_ready: sbx.workloads.filter((w) => w.replicasReady >= w.replicasDesired).length,
      workloads_total: sbx.workloads.length,
      error_summary: sbx.errorSummary,
      updated_at: sbx.updatedAt,
    };
  },

  async provisionSandbox(payload: SandboxCreatePayload, _idempotencyKey?: string): Promise<Sandbox> {
    await new Promise((r) => setTimeout(r, 200));
    const randomHex = Math.random().toString(16).substring(2, 10);
    const newId = `sbx-${randomHex}`;
    const namespace = `sandbox-default-${randomHex}`;

    const newSandbox: Sandbox = {
      id: newId,
      tenantId: 'c1f7b0f6-9304-4c57-897e-d309085ec617',
      projectId: payload.projectId,
      name: payload.name,
      topologyId: payload.topologyId || 'topo-microservices-default',
      k8sNamespace: namespace,
      clusterId: payload.clusterId || 'sandbox-alpha-us-east-1',
      status: 'PROVISIONING',
      workloads: [],
      quota: {
        cpuRequest: payload.resourceProfile?.cpu_request || '2',
        cpuLimit: payload.resourceProfile?.cpu_limit || '4',
        memoryRequest: payload.resourceProfile?.memory_request || '4Gi',
        memoryLimit: payload.resourceProfile?.memory_limit || '8Gi',
        maxPods: payload.resourceProfile?.max_pods || 20,
      },
      resourceProfile: {
        profileName: (payload.resourceProfile?.profile_name as any) || 'standard',
        cpuRequest: payload.resourceProfile?.cpu_request || '2',
        cpuLimit: payload.resourceProfile?.cpu_limit || '4',
        memoryRequest: payload.resourceProfile?.memory_request || '4Gi',
        memoryLimit: payload.resourceProfile?.memory_limit || '8Gi',
        maxPods: payload.resourceProfile?.max_pods || 20,
      },
      isIsolated: false,
      progressPercentage: 25,
      currentStep: 'Creating isolated namespace and applying ResourceQuota...',
      expiresAt: new Date(Date.now() + (payload.ttlHours || 4) * 3600 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockSandboxes.push(newSandbox);

    // Simulate async progression to READY
    setTimeout(() => {
      const target = mockSandboxes.find((s) => s.id === newId);
      if (target && target.status === 'PROVISIONING') {
        target.progressPercentage = 65;
        target.currentStep = 'Injecting Toxiproxy sidecars and applying NetworkPolicy...';
        target.isIsolated = true;
      }
    }, 1200);

    setTimeout(() => {
      const target = mockSandboxes.find((s) => s.id === newId);
      if (target && target.status === 'PROVISIONING') {
        target.status = 'READY';
        target.progressPercentage = 100;
        target.currentStep = 'All workloads verified and ready';
        target.workloads = DEFAULT_SAMPLE_WORKLOADS.map((w) => ({
          ...w,
          namespace,
          pods: w.pods.map((p) => ({ ...p, namespace })),
        }));
      }
    }, 2500);

    return { ...newSandbox };
  },

  async deleteSandbox(id: string): Promise<{ id: string; status: string; message: string }> {
    await new Promise((r) => setTimeout(r, 150));
    const index = mockSandboxes.findIndex((s) => s.id === id);
    if (index !== -1) {
      mockSandboxes[index].status = 'TERMINATING';
      setTimeout(() => {
        mockSandboxes = mockSandboxes.filter((s) => s.id !== id);
      }, 1000);
    }
    return { id, status: 'TERMINATING', message: 'Teardown initiated' };
  },

  async reconcile(): Promise<{ stuck_sandboxes_recovered: number; expired_sandboxes_terminated: number; orphaned_namespaces_purged: number; timestamp: string }> {
    return {
      stuck_sandboxes_recovered: 0,
      expired_sandboxes_terminated: 0,
      orphaned_namespaces_purged: 0,
      timestamp: new Date().toISOString(),
    };
  },
};
