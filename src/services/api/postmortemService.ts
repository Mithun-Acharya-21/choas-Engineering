import {
  AIIncidentExplanation,
  GenerateExplanationRequest,
  GeneratePostmortemRequest,
  IncidentPostmortem,
  LifecycleTransitionRequest,
  PostmortemActionItem,
  SingleActionItemUpdate,
} from '../../types/domain/postmortem';
import { apiClient } from './apiClient';

export const postmortemService = {
  /**
   * Generates or retrieves cached AI explanation grounded in deterministic M8 RCA.
   */
  async getOrGenerateExplanation(
    incidentId: string,
    req?: GenerateExplanationRequest
  ): Promise<AIIncidentExplanation> {
    return apiClient.post<AIIncidentExplanation>(`/incidents/${incidentId}/explanation`, req || {});
  },

  /**
   * Generates an official incident postmortem with action items.
   */
  async generatePostmortem(
    incidentId: string,
    req?: GeneratePostmortemRequest
  ): Promise<IncidentPostmortem> {
    return apiClient.post<IncidentPostmortem>(`/incidents/${incidentId}/postmortem`, req || {});
  },

  /**
   * Fetches latest postmortem for an incident.
   */
  async getPostmortemByIncident(incidentId: string): Promise<IncidentPostmortem | null> {
    return apiClient.get<IncidentPostmortem | null>(`/incidents/${incidentId}/postmortem`);
  },

  /**
   * Fetches postmortem report by report ID.
   */
  async getPostmortemById(postmortemId: string): Promise<IncidentPostmortem> {
    return apiClient.get<IncidentPostmortem>(`/postmortems/${postmortemId}`);
  },

  /**
   * Updates all action items on a postmortem report.
   */
  async updateActionItems(
    postmortemId: string,
    actionItems: PostmortemActionItem[]
  ): Promise<IncidentPostmortem> {
    return apiClient.patch<IncidentPostmortem>(`/postmortems/${postmortemId}/action-items`, {
      action_items: actionItems,
    });
  },

  /**
   * Updates a specific action item on a postmortem report.
   */
  async updateSingleActionItem(
    postmortemId: string,
    actionItemId: string,
    updates: SingleActionItemUpdate
  ): Promise<IncidentPostmortem> {
    return apiClient.patch<IncidentPostmortem>(
      `/postmortems/${postmortemId}/action-items/${actionItemId}`,
      updates
    );
  },

  /**
   * Transitions lifecycle state (DRAFT -> IN_REVIEW -> APPROVED -> PUBLISHED).
   */
  async transitionLifecycle(
    postmortemId: string,
    req: LifecycleTransitionRequest
  ): Promise<IncidentPostmortem> {
    return apiClient.post<IncidentPostmortem>(`/postmortems/${postmortemId}/transition`, req);
  },

  /**
   * Approves postmortem (TenantOwner only).
   */
  async approvePostmortem(postmortemId: string): Promise<IncidentPostmortem> {
    return apiClient.post<IncidentPostmortem>(`/postmortems/${postmortemId}/approve`, {});
  },

  /**
   * Publishes postmortem (TenantOwner only).
   */
  async publishPostmortem(postmortemId: string): Promise<IncidentPostmortem> {
    return apiClient.post<IncidentPostmortem>(`/postmortems/${postmortemId}/publish`, {});
  },

  /**
   * Initiates browser download of the postmortem PDF document.
   */
  getExportPdfUrl(postmortemId: string): string {
    const baseUrl = (import.meta.env.VITE_API_BASE_URL as string) || '/api/v1';
    return `${baseUrl}/postmortems/${postmortemId}/pdf`;
  },
};
