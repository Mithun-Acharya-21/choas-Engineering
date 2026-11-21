import { Project, Tenant, TenantMembership, TenantRole, User } from '../../types';
import { CreateTenantPayload, LoginResponse, RegisterPayload, RegisterResponse } from '../api/authService';
import { CreateProjectPayload } from '../api/projectService';

export interface MockUserRecord extends User {
  password: string;
}

export const MOCK_USERS: MockUserRecord[] = [
  {
    id: 'usr-sre-01',
    email: 'sre.lead@acme.com',
    fullName: 'Alex Mercer',
    password: 'SecurePassword123!',
    isActive: true,
    isSuperuser: false,
    activeTenantId: 'c1f7b0f6-9304-4c57-897e-d309085ec617',
    role: 'TenantOwner',
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
  },
  {
    id: 'usr-eng-02',
    email: 'dev.engineer@acme.com',
    fullName: 'Sarah Connor',
    password: 'SecurePassword123!',
    isActive: true,
    isSuperuser: false,
    activeTenantId: 'c1f7b0f6-9304-4c57-897e-d309085ec617',
    role: 'Engineer',
    createdAt: '2026-11-05T00:00:00Z',
    updatedAt: '2026-11-05T00:00:00Z',
  },
  {
    id: 'usr-view-03',
    email: 'auditor.compliance@acme.com',
    fullName: 'Jordan Reed',
    password: 'SecurePassword123!',
    isActive: true,
    isSuperuser: false,
    activeTenantId: 'c1f7b0f6-9304-4c57-897e-d309085ec617',
    role: 'Viewer',
    createdAt: '2026-11-10T00:00:00Z',
    updatedAt: '2026-11-10T00:00:00Z',
  },
];

export const MOCK_TENANTS: Tenant[] = [
  {
    id: 'c1f7b0f6-9304-4c57-897e-d309085ec617',
    name: 'Acme Corp Platform',
    slug: 'acme-corp-platform',
    tier: 'enterprise',
    role: 'TenantOwner',
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
  },
  {
    id: 'e22a59f6-0df7-45bf-90b5-772c918f8872',
    name: 'Acme SRE Lab',
    slug: 'acme-sre-lab',
    tier: 'standard',
    role: 'TenantOwner',
    createdAt: '2026-11-05T00:00:00Z',
    updatedAt: '2026-11-05T00:00:00Z',
  },
];

export const MOCK_PROJECTS: Record<string, Project[]> = {
  'c1f7b0f6-9304-4c57-897e-d309085ec617': [
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      tenantId: 'c1f7b0f6-9304-4c57-897e-d309085ec617',
      name: 'E-Commerce Checkout Resilience',
      slug: 'ecommerce-checkout',
      description: 'Validating circuit breakers and timeouts between order and payment services.',
      sandboxesCount: 2,
      experimentsCount: 6,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      tenantId: 'c1f7b0f6-9304-4c57-897e-d309085ec617',
      name: 'Core Payment Gateway Mesh',
      slug: 'payment-gateway-v2',
      description: 'Evaluating latency degradation on PSP mock endpoints and settlement queues.',
      sandboxesCount: 1,
      experimentsCount: 3,
      createdAt: '2026-11-06T00:00:00Z',
      updatedAt: '2026-11-06T00:00:00Z',
    },
  ],
  'e22a59f6-0df7-45bf-90b5-772c918f8872': [
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      tenantId: 'e22a59f6-0df7-45bf-90b5-772c918f8872',
      name: 'Staging Mesh Canary',
      slug: 'mesh-canary-lab',
      description: 'Canary sandbox experiments evaluating packet drop resilience.',
      sandboxesCount: 1,
      experimentsCount: 1,
      createdAt: '2026-11-08T00:00:00Z',
      updatedAt: '2026-11-08T00:00:00Z',
    },
  ],
};

export const MOCK_MEMBERSHIPS: Record<string, TenantMembership[]> = {
  'c1f7b0f6-9304-4c57-897e-d309085ec617': [
    {
      id: 'mem-01',
      tenantId: 'c1f7b0f6-9304-4c57-897e-d309085ec617',
      userId: 'usr-sre-01',
      userEmail: 'sre.lead@acme.com',
      userName: 'Alex Mercer',
      role: 'TenantOwner',
      createdAt: '2026-11-01T00:00:00Z',
    },
    {
      id: 'mem-02',
      tenantId: 'c1f7b0f6-9304-4c57-897e-d309085ec617',
      userId: 'usr-eng-02',
      userEmail: 'dev.engineer@acme.com',
      userName: 'Sarah Connor',
      role: 'Engineer',
      createdAt: '2026-11-05T00:00:00Z',
    },
    {
      id: 'mem-03',
      tenantId: 'c1f7b0f6-9304-4c57-897e-d309085ec617',
      userId: 'usr-view-03',
      userEmail: 'auditor.compliance@acme.com',
      userName: 'Jordan Reed',
      role: 'Viewer',
      createdAt: '2026-11-10T00:00:00Z',
    },
  ],
};

class MockAuthService {
  private users: MockUserRecord[] = [...MOCK_USERS];
  private tenants: Tenant[] = [...MOCK_TENANTS];
  private projects: Record<string, Project[]> = { ...MOCK_PROJECTS };
  private memberships: Record<string, TenantMembership[]> = { ...MOCK_MEMBERSHIPS };

  public async login(username: string, password: string): Promise<LoginResponse> {
    const user = this.users.find(
      (u) => u.email.toLowerCase() === username.trim().toLowerCase()
    );

    if (!user || user.password !== password) {
      throw new Error('Invalid email or password.');
    }

    if (!user.isActive) {
      throw new Error('Account has been deactivated. Contact your tenant administrator.');
    }

    const token = `mock-jwt-${user.id}-${Date.now()}`;
    return {
      access_token: token,
      token_type: 'bearer',
      expires_in: 900,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.fullName,
        active_tenant_id: user.activeTenantId || this.tenants[0].id,
        role: user.role || 'TenantOwner',
      },
    };
  }

  public async register(payload: RegisterPayload): Promise<RegisterResponse> {
    const existing = this.users.find(
      (u) => u.email.toLowerCase() === payload.email.trim().toLowerCase()
    );
    if (existing) {
      throw new Error(`User with email '${payload.email}' already exists.`);
    }

    const tenantId = `tenant-${Date.now()}`;
    const tenantSlug = payload.tenant_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const newTenant: Tenant = {
      id: tenantId,
      name: payload.tenant_name,
      slug: tenantSlug,
      tier: 'standard',
      role: 'TenantOwner',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.tenants.push(newTenant);

    const userId = `usr-${Date.now()}`;
    const newUser: MockUserRecord = {
      id: userId,
      email: payload.email.trim().toLowerCase(),
      fullName: payload.full_name,
      password: payload.password,
      isActive: true,
      isSuperuser: false,
      activeTenantId: tenantId,
      role: 'TenantOwner',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.users.push(newUser);

    // Initial default project
    const defaultProject: Project = {
      id: `proj-${Date.now()}`,
      tenantId,
      name: 'Default Workspace',
      slug: 'default-workspace',
      description: 'Initial project for chaos engineering experiments.',
      sandboxesCount: 0,
      experimentsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.projects[tenantId] = [defaultProject];

    this.memberships[tenantId] = [
      {
        id: `mem-${Date.now()}`,
        tenantId,
        userId,
        userEmail: payload.email,
        userName: payload.full_name,
        role: 'TenantOwner',
        createdAt: new Date().toISOString(),
      },
    ];

    return {
      user_id: userId,
      email: newUser.email,
      full_name: newUser.fullName,
      tenant_id: tenantId,
      tenant_slug: tenantSlug,
      role: 'TenantOwner',
      created_at: newUser.createdAt,
    };
  }

  public async listTenants(): Promise<{ items: Tenant[] }> {
    return { items: [...this.tenants] };
  }

  public async createTenant(payload: CreateTenantPayload): Promise<Tenant> {
    const existing = this.tenants.find((t) => t.slug === payload.slug);
    if (existing) {
      throw new Error(`Tenant with slug '${payload.slug}' already exists.`);
    }

    const newTenant: Tenant = {
      id: `tenant-${Date.now()}`,
      name: payload.name,
      slug: payload.slug,
      tier: 'standard',
      role: 'TenantOwner',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.tenants.push(newTenant);
    this.projects[newTenant.id] = [];
    return newTenant;
  }

  public async listProjects(tenantId: string): Promise<{ items: Project[] }> {
    return { items: this.projects[tenantId] || [] };
  }

  public async createProject(tenantId: string, payload: CreateProjectPayload): Promise<Project> {
    const tenantProjects = this.projects[tenantId] || [];
    const existing = tenantProjects.find((p) => p.slug === payload.slug);
    if (existing) {
      throw new Error(`Project with slug '${payload.slug}' already exists in this tenant.`);
    }

    const newProj: Project = {
      id: `proj-${Date.now()}`,
      tenantId,
      name: payload.name,
      slug: payload.slug,
      description: payload.description,
      sandboxesCount: 0,
      experimentsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.projects[tenantId] = [newProj, ...tenantProjects];
    return newProj;
  }

  public async listMemberships(tenantId: string): Promise<{ items: TenantMembership[] }> {
    return { items: this.memberships[tenantId] || [] };
  }
}

export const mockAuthService = new MockAuthService();
