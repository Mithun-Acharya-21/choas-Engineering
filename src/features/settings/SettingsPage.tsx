import React, { useState } from 'react';
import { Building, Folder, LogOut, Plus, Shield, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { canAdministerTenant, canManageProjects } from '../../context/rbac';
import { MOCK_MEMBERSHIPS } from '../../services/mock/mockAuthService';
import { CreateProjectModal } from '../projects/CreateProjectModal';
import { CreateTenantModal } from '../tenants/CreateTenantModal';

export const SettingsPage: React.FC = () => {
  const { user, activeTenant, projects, role, logout } = useAuth();
  const [tenantModalOpen, setTenantModalOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);

  const memberships = activeTenant ? MOCK_MEMBERSHIPS[activeTenant.id] || [] : [];

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 p-4 lg:p-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[#27272a] pb-4">
        <div>
          <h1 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-[#fafafa]">
            Workspace & Organization Settings
          </h1>
          <p className="mt-0.5 font-mono text-[11px] text-[#71717a]">
            Manage multi-tenant organization boundaries, member roles, and project configurations
          </p>
        </div>

        <button
          type="button"
          onClick={logout}
          className="flex h-8 items-center gap-1.5 rounded border border-[#f43f5e]/40 bg-[#f43f5e]/10 px-3 font-mono text-[11px] text-[#f43f5e] hover:bg-[#f43f5e]/20 transition-colors self-start sm:self-auto"
        >
          <LogOut className="h-3.5 w-3.5" />
          Terminate Session (Logout)
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column (8 cols): Organization & Projects */}
        <div className="space-y-6 lg:col-span-8">
          {/* Tenant Details Card */}
          <div className="rounded-lg border border-[#27272a] bg-[#18181b] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-3">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-[#6366f1]" />
                <h2 className="font-display text-[15px] font-semibold text-[#fafafa]">
                  Tenant Workspace Information
                </h2>
              </div>
              <span className="rounded bg-[#6366f1]/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#6366f1] uppercase">
                {activeTenant?.tier} TIER
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 font-mono text-[12px]">
              <div>
                <span className="text-[#71717a] block text-[10px] uppercase">Tenant Name</span>
                <span className="text-[#fafafa] font-medium text-[13px]">{activeTenant?.name}</span>
              </div>
              <div>
                <span className="text-[#71717a] block text-[10px] uppercase">Tenant Slug</span>
                <span className="text-[#a1a1aa]">{activeTenant?.slug}</span>
              </div>
              <div>
                <span className="text-[#71717a] block text-[10px] uppercase">Tenant UUID</span>
                <span className="text-[#71717a] text-[11px] truncate block">{activeTenant?.id}</span>
              </div>
              <div>
                <span className="text-[#71717a] block text-[10px] uppercase">Created At</span>
                <span className="text-[#a1a1aa]">{activeTenant?.createdAt ? new Date(activeTenant.createdAt).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>

            {canAdministerTenant(role) && (
              <div className="border-t border-[#27272a] pt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setTenantModalOpen(true)}
                  className="flex items-center gap-1.5 rounded border border-[#27272a] bg-[#111113] px-3 py-1.5 font-mono text-[11px] text-[#fafafa] hover:bg-[#202024]"
                >
                  <Plus className="h-3 w-3" />
                  Create Additional Tenant
                </button>
              </div>
            )}
          </div>

          {/* Projects Card */}
          <div className="rounded-lg border border-[#27272a] bg-[#18181b] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-3">
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-[#6366f1]" />
                <h2 className="font-display text-[15px] font-semibold text-[#fafafa]">
                  Projects Scoped to Active Tenant ({projects.length})
                </h2>
              </div>
              {canManageProjects(role) && (
                <button
                  type="button"
                  onClick={() => setProjectModalOpen(true)}
                  className="flex items-center gap-1.5 rounded bg-[#6366f1] px-2.5 py-1 font-mono text-[11px] font-semibold text-white hover:bg-[#4f46e5]"
                >
                  <Plus className="h-3 w-3" />
                  New Project
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {projects.length === 0 ? (
                <div className="rounded border border-dashed border-[#27272a] p-6 text-center font-mono text-[11px] text-[#71717a]">
                  No projects configured in this tenant.
                </div>
              ) : (
                projects.map((proj) => (
                  <div
                    key={proj.id}
                    className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between rounded border border-[#27272a] bg-[#111113] p-3 font-mono text-[12px]"
                  >
                    <div>
                      <h4 className="font-semibold text-[#fafafa]">{proj.name}</h4>
                      <p className="text-[11px] text-[#71717a] mt-0.5">{proj.description || proj.slug}</p>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-[#a1a1aa] shrink-0 mt-1 sm:mt-0">
                      <span>{proj.sandboxesCount ?? 0} sandboxes</span>
                      <span className="text-[#27272a]">·</span>
                      <span>{proj.experimentsCount ?? 0} experiments</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Memberships Card */}
          <div className="rounded-lg border border-[#27272a] bg-[#18181b] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#27272a] pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#6366f1]" />
                <h2 className="font-display text-[15px] font-semibold text-[#fafafa]">
                  Tenant Members & RBAC Roles ({memberships.length})
                </h2>
              </div>
            </div>

            <div className="divide-y divide-[#27272a]">
              {memberships.map((mem) => (
                <div key={mem.id} className="py-2.5 flex items-center justify-between font-mono text-[12px]">
                  <div>
                    <span className="font-semibold text-[#fafafa]">{mem.userName}</span>
                    <span className="text-[#71717a] text-[11px] ml-2">({mem.userEmail})</span>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                      mem.role === 'TenantOwner'
                        ? 'border border-[#6366f1]/40 bg-[#6366f1]/15 text-[#6366f1]'
                        : mem.role === 'Engineer'
                        ? 'border border-[#38bdf8]/40 bg-[#38bdf8]/15 text-[#38bdf8]'
                        : 'border border-[#71717a]/40 bg-[#71717a]/15 text-[#a1a1aa]'
                    }`}
                  >
                    {mem.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): User Profile & Security Details */}
        <div className="space-y-6 lg:col-span-4">
          {/* User Profile Card */}
          <div className="rounded-lg border border-[#27272a] bg-[#18181b] p-5 space-y-3.5">
            <h3 className="font-display text-[14px] font-semibold text-[#fafafa] border-b border-[#27272a] pb-2">
              Authenticated User Profile
            </h3>

            <div className="space-y-2 font-mono text-[11px]">
              <div>
                <span className="text-[#71717a] block">Identity</span>
                <span className="text-[#fafafa] font-medium">{user?.fullName}</span>
              </div>
              <div>
                <span className="text-[#71717a] block">Email</span>
                <span className="text-[#a1a1aa]">{user?.email}</span>
              </div>
              <div>
                <span className="text-[#71717a] block">Effective Role</span>
                <span className="inline-flex items-center gap-1 text-[#6366f1] font-semibold">
                  <Shield className="h-3 w-3" />
                  {role}
                </span>
              </div>
            </div>
          </div>

          {/* Security & Multi-Tenant Invariants */}
          <div className="rounded-lg border border-[#10b981]/25 bg-[#10b981]/5 p-4 font-mono text-[11px] text-[#10b981] space-y-2">
            <h4 className="font-semibold flex items-center gap-1.5 text-[#10b981]">
              <Shield className="h-3.5 w-3.5" />
              Multi-Tenancy Guardrail
            </h4>
            <p className="text-[#a1a1aa] text-[10px] leading-relaxed">
              Every request carries the verified JWT claims and <span className="text-[#fafafa]">X-Tenant-ID</span> header. The backend enforces isolation at the SQL query and Kubernetes namespace layers.
            </p>
          </div>
        </div>
      </div>

      <CreateTenantModal open={tenantModalOpen} onClose={() => setTenantModalOpen(false)} />
      <CreateProjectModal open={projectModalOpen} onClose={() => setProjectModalOpen(false)} />
    </div>
  );
};
