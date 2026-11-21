import { ChaosExperiment, ExperimentRun } from '../../types';
import { apiClient } from './apiClient';

export interface CreateExperimentPayload {
  projectId: string;
  name: string;
  description?: string;
  faultType: string;
  durationSeconds: number;
  configuration: Record<string, unknown>;
}

export const chaosService = {
  async listExperiments(): Promise<ChaosExperiment[]> {
    return apiClient.get<ChaosExperiment[]>('/experiments');
  },

  async getExperiment(id: string): Promise<ChaosExperiment> {
    return apiClient.get<ChaosExperiment>(`/experiments/${id}`);
  },

  async createExperiment(payload: CreateExperimentPayload): Promise<ChaosExperiment> {
    return apiClient.post<ChaosExperiment>('/experiments', payload);
  },

  async runExperiment(experimentId: string, sandboxId: string): Promise<ExperimentRun> {
    return apiClient.post<ExperimentRun>(`/experiments/${experimentId}/run`, { sandbox_id: sandboxId });
  },

  async stopExperiment(experimentId: string): Promise<{ run_id: string; status: string; message: string }> {
    return apiClient.post<{ run_id: string; status: string; message: string }>(`/experiments/${experimentId}/stop`);
  },
};
