export interface Project {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  sandboxesCount?: number;
  experimentsCount?: number;
  createdAt: string;
  updatedAt: string;
}
