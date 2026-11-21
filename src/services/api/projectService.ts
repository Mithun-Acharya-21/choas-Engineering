import { Project } from '../../types';
import { apiClient } from './apiClient';

export interface CreateProjectPayload {
  name: string;
  slug: string;
  description?: string;
}

export const projectService = {
  async listProjects(): Promise<{ items: Project[] }> {
    return apiClient.get<{ items: Project[] }>('/projects');
  },

  async createProject(payload: CreateProjectPayload): Promise<Project> {
    return apiClient.post<Project>('/projects', payload);
  },
};
