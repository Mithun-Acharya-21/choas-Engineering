import {
  RCAAnalysis,
  RCACandidate,
  RCADependencyPath,
  RCAEvidence,
} from '../../types/domain/rca';
import { apiClient } from './apiClient';

export const rcaService = {
  async startRCAAnalysis(
    incidentId: string,
    algorithmVersion: string = 'v1.0.0-deterministic',
    forceRecompute: boolean = false
  ): Promise<RCAAnalysis> {
    return apiClient.post<RCAAnalysis>(`/incidents/${incidentId}/rca/analyze`, {
      algorithm_version: algorithmVersion,
      force_recompute: forceRecompute,
    });
  },

  async getLatestRCA(incidentId: string): Promise<RCAAnalysis | null> {
    return apiClient.get<RCAAnalysis | null>(`/incidents/${incidentId}/rca`);
  },

  async getAnalysis(analysisId: string): Promise<RCAAnalysis> {
    return apiClient.get<RCAAnalysis>(`/rca/${analysisId}`);
  },

  async getCandidates(analysisId: string): Promise<{
    analysis_id: string;
    incident_id: string;
    status: string;
    algorithm_version: string;
    candidates: RCACandidate[];
    primary_root_cause?: RCACandidate | null;
    collateral_symptoms: RCACandidate[];
  }> {
    return apiClient.get(`/rca/${analysisId}/candidates`);
  },

  async getEvidence(analysisId: string): Promise<RCAEvidence[]> {
    return apiClient.get<RCAEvidence[]>(`/rca/${analysisId}/evidence`);
  },

  async getPropagation(analysisId: string): Promise<{
    analysis_id: string;
    incident_id: string;
    paths: RCADependencyPath[];
    primary_fault_origin?: string | null;
  }> {
    return apiClient.get(`/rca/${analysisId}/propagation`);
  },

  async rerunAnalysis(
    analysisId: string,
    algorithmVersion: string = 'v1.0.0-deterministic',
    customWeights?: Record<string, number>
  ): Promise<RCAAnalysis> {
    return apiClient.post<RCAAnalysis>(`/rca/${analysisId}/rerun`, {
      algorithm_version: algorithmVersion,
      custom_weights: customWeights,
    });
  },
};
