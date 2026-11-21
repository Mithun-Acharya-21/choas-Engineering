import {
  ServiceTopology,
  TopologyCreatePayload,
  TopologyDeployResponse,
  TopologyEdge,
  TopologyNode,
  TopologyUpdatePayload,
  TopologyValidationResult,
  TopologyVersionRecord,
} from '../../types/domain/topology';
import { apiClient } from './apiClient';

export const topologyService = {
  async listTopologies(projectId?: string): Promise<ServiceTopology[]> {
    const url = projectId ? `/topologies?project_id=${projectId}` : '/topologies';
    const response = await apiClient.get<any>(url);
    if (Array.isArray(response)) return response;
    if (response && Array.isArray(response.items)) return response.items;
    return [];
  },

  async getTopology(id: string): Promise<ServiceTopology> {
    return apiClient.get<ServiceTopology>(`/topologies/${id}`);
  },

  async createTopology(payload: TopologyCreatePayload): Promise<ServiceTopology> {
    return apiClient.post<ServiceTopology>('/topologies', payload);
  },

  async updateTopology(id: string, payload: TopologyUpdatePayload): Promise<ServiceTopology> {
    return apiClient.put<ServiceTopology>(`/topologies/${id}`, payload);
  },

  async validateTopology(nodes: TopologyNode[], edges: TopologyEdge[]): Promise<TopologyValidationResult> {
    return apiClient.post<TopologyValidationResult>('/topologies/validate', { nodes, edges });
  },

  async getTopologyVersions(id: string): Promise<TopologyVersionRecord[]> {
    return apiClient.get<TopologyVersionRecord[]>(`/topologies/${id}/versions`);
  },

  async revertTopologyVersion(id: string, targetVersion: number): Promise<ServiceTopology> {
    return apiClient.post<ServiceTopology>(`/topologies/${id}/revert`, { target_version: targetVersion });
  },

  async deployTopology(topologyId: string, sandboxId: string): Promise<TopologyDeployResponse> {
    return apiClient.post<TopologyDeployResponse>(`/topologies/${topologyId}/deploy`, { sandbox_id: sandboxId });
  },
};
