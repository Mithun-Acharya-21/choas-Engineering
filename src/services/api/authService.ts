import { Tenant, User } from '../../types';
import { apiClient } from './apiClient';

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  tenant_name: string;
}

export interface RegisterResponse {
  user_id: string;
  email: string;
  full_name: string;
  tenant_id: string;
  tenant_slug: string;
  role: string;
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: {
    id: string;
    email: string;
    full_name: string;
    active_tenant_id: string;
    role: string;
  };
}

export interface CreateTenantPayload {
  name: string;
  slug: string;
}

export const authService = {
  async register(payload: RegisterPayload): Promise<RegisterResponse> {
    return apiClient.post<RegisterResponse>('/auth/register', payload);
  },

  async login(username: string, password: string): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>('/auth/login', { username, password });
  },

  async refreshToken(): Promise<{ access_token: string; token_type: string; expires_in: number }> {
    return apiClient.post('/auth/refresh');
  },

  async listTenants(): Promise<{ items: Tenant[] }> {
    return apiClient.get<{ items: Tenant[] }>('/tenants');
  },

  async getTenant(id: string): Promise<Tenant> {
    return apiClient.get<Tenant>(`/tenants/${id}`);
  },

  async createTenant(payload: CreateTenantPayload): Promise<Tenant> {
    return apiClient.post<Tenant>('/tenants', payload);
  },
};
