import React, { useState } from 'react';
import { Building, Check, ChevronDown, Plus, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { canAdministerTenant } from '../../context/rbac';
import { CreateTenantModal } from './CreateTenantModal';

interface TenantSwitcherProps {
  collapsed?: boolean;
}

export const TenantSwitcher: React.FC<TenantSwitcherProps> = ({ collapsed = false }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const { activeTenant, tenants, selectTenant, role } = useAuth();

  const handleSelect = async (tenantId: string) => {
    await selectTenant(tenantId);
    setDropdownOpen(false);
  };

  if (!activeTenant) return null;

  return (
    <div className="relative">
      {!collapsed ? (
        <div className="rounded border border-[#27272a] bg-[#09090b] p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#71717a]">
              Active Tenant
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-[#18181b] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[#6366f1]">
              <Shield className="h-2.5 w-2.5" />
              {role}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex h-7 w-full items-center justify-between gap-1.5 rounded px-1.5 text-left font-mono text-[12px] font-medium text-[#fafafa] hover:bg-[#18181b] transition-colors"
          >
            <span className="truncate">{activeTenant.name}</span>
            <ChevronDown className="h-3 w-3 shrink-0 text-[#71717a]" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          title={`Tenant: ${activeTenant.name} (${role})`}
          className="mx-auto flex h-8 w-9 items-center justify-center rounded border border-[#27272a] bg-[#09090b] text-[#6366f1] hover:border-[#6366f1]"
        >
          <Building className="h-4 w-4" />
        </button>
      )}

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)} aria-hidden="true" />
          <div className="absolute left-0 top-full z-40 mt-1 w-60 rounded-lg border border-[#27272a] bg-[#18181b] p-1.5 shadow-2xl overlay-elevation font-mono text-[11px]">
            <div className="px-2 py-1 text-[10px] text-[#71717a] uppercase tracking-wider border-b border-[#27272a]">
              Switch Workspace
            </div>

            <div className="max-h-48 overflow-y-auto py-1 space-y-0.5">
              {tenants.map((t) => {
                const isSelected = t.id === activeTenant.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelect(t.id)}
                    className={`flex h-8 w-full items-center justify-between rounded px-2 text-left transition-colors ${
                      isSelected
                        ? 'bg-[#202024] text-[#fafafa] font-semibold'
                        : 'text-[#a1a1aa] hover:bg-[#111113] hover:text-[#fafafa]'
                    }`}
                  >
                    <div className="truncate">
                      <div>{t.name}</div>
                      <div className="text-[9px] text-[#71717a] truncate">{t.slug}</div>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-[#10b981] shrink-0" />}
                  </button>
                );
              })}
            </div>

            {canAdministerTenant(role) && (
              <div className="border-t border-[#27272a] pt-1 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false);
                    setCreateModalOpen(true);
                  }}
                  className="flex h-7 w-full items-center gap-1.5 rounded px-2 text-[#6366f1] hover:bg-[#111113] transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  <span>New Tenant Workspace</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <CreateTenantModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} />
    </div>
  );
};
