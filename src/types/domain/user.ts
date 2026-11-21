import { TenantRole } from './tenant';

export interface User {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  isSuperuser: boolean;
  activeTenantId?: string;
  role?: TenantRole;
  createdAt: string;
  updatedAt: string;
}
