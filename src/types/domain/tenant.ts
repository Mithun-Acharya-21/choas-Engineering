export type TenantRole = 'TenantOwner' | 'Engineer' | 'Viewer';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  tier: 'standard' | 'enterprise';
  role?: TenantRole;
  createdAt: string;
  updatedAt: string;
}

export interface TenantMembership {
  id: string;
  tenantId: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  role: TenantRole;
  createdAt: string;
}

export interface TenantQuota {
  maxSandboxes: number;
  maxConcurrentExperiments: number;
  maxNodesPerTopology: number;
}
