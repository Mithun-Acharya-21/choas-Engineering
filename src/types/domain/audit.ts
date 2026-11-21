export type AuditAction =
  | 'AUTH_LOGIN'
  | 'AUTH_LOGOUT'
  | 'SANDBOX_PROVISION'
  | 'SANDBOX_TEARDOWN'
  | 'EXPERIMENT_LAUNCH'
  | 'EXPERIMENT_HALT'
  | 'KILL_SWITCH_TRIGGERED'
  | 'TOPOLOGY_UPDATE'
  | 'INCIDENT_ANALYZE'
  | 'REPORT_EXPORT';

export interface AuditEvent {
  id: string;
  tenantId: string;
  userId?: string;
  userEmail?: string;
  action: AuditAction;
  resourceType: 'SANDBOX' | 'EXPERIMENT' | 'TOPOLOGY' | 'INCIDENT' | 'TENANT';
  resourceId?: string;
  clientIp?: string;
  details: Record<string, unknown>;
  createdAt: string;
}
