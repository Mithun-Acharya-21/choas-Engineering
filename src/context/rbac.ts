import { TenantRole } from '../types/domain';

export type AppPermission =
  | 'org:admin'          // Invite members, change roles, delete tenant
  | 'project:manage'     // Create, edit, delete projects
  | 'project:view'       // View projects
  | 'sandbox:operate'    // Provision, teardown sandboxes
  | 'sandbox:view'       // View sandboxes & workload metrics
  | 'chaos:execute'      // Launch & halt chaos experiments
  | 'incident:manage'    // Triage & trigger deterministic RCA
  | 'report:view'        // View & download post-mortem reports
  | 'report:approve'     // Sign-off and approve post-mortem remediation
  | 'audit:view';        // View immutable audit trail

const ROLE_PERMISSIONS: Record<TenantRole, AppPermission[]> = {
  TenantOwner: [
    'org:admin',
    'project:manage',
    'project:view',
    'sandbox:operate',
    'sandbox:view',
    'chaos:execute',
    'incident:manage',
    'report:view',
    'report:approve',
    'audit:view',
  ],
  Engineer: [
    'project:manage',
    'project:view',
    'sandbox:operate',
    'sandbox:view',
    'chaos:execute',
    'incident:manage',
    'report:view',
  ],
  Viewer: [
    'project:view',
    'sandbox:view',
    'report:view',
  ],
};

export function hasPermission(role: TenantRole | undefined, permission: AppPermission): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role];
  return permissions ? permissions.includes(permission) : false;
}

export function canAdministerTenant(role?: TenantRole): boolean {
  return hasPermission(role, 'org:admin');
}

export function canManageProjects(role?: TenantRole): boolean {
  return hasPermission(role, 'project:manage');
}

export function canOperateSandboxes(role?: TenantRole): boolean {
  return hasPermission(role, 'sandbox:operate');
}

export function canExecuteChaos(role?: TenantRole): boolean {
  return hasPermission(role, 'chaos:execute');
}

export function canManageIncidents(role?: TenantRole): boolean {
  return hasPermission(role, 'incident:manage');
}

export function canViewReports(role?: TenantRole): boolean {
  return hasPermission(role, 'report:view');
}

export function canApproveReports(role?: TenantRole): boolean {
  return hasPermission(role, 'report:approve');
}
