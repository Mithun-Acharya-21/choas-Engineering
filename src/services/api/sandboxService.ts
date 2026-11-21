import { Sandbox, SandboxCreatePayload, SandboxStatusResponse } from '../../types/domain/sandbox';
import { apiClient } from './apiClient';

export const sandboxService = {
  async listSandboxes(projectId?: string): Promise<Sandbox[]> {
    const url = projectId ? `/sandboxes?project_id=${projectId}` : '/sandboxes';
    const response = await apiClient.get<any>(url);
    // Support both direct array and wrapped response { items: [...] }
    if (Array.isArray(response)) {
      return response;
    }
    if (response && Array.isArray(response.items)) {
      return response.items;
    }
    return [];
  },

  async getSandbox(id: string): Promise<Sandbox> {
    return apiClient.get<Sandbox>(`/sandboxes/${id}`);
  },

  async getSandboxStatus(id: string): Promise<SandboxStatusResponse> {
    return apiClient.get<SandboxStatusResponse>(`/sandboxes/${id}/status`);
  },

  async provisionSandbox(payload: SandboxCreatePayload, idempotencyKey?: string): Promise<Sandbox> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    return apiClient.post<Sandbox>('/sandboxes', payload, { headers });
  },

  async deleteSandbox(id: string): Promise<{ id: string; status: string; message: string }> {
    return apiClient.delete<{ id: string; status: string; message: string }>(`/sandboxes/${id}`);
  },

  async reconcile(): Promise<{ stuck_sandboxes_recovered: number; expired_sandboxes_terminated: number; orphaned_namespaces_purged: number; timestamp: string }> {
    return apiClient.post('/sandboxes/reconcile', {});
  },
};
