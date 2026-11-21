import React, { useState } from 'react';
import { Check, ChevronDown, Folder, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { canManageProjects } from '../../context/rbac';
import { CreateProjectModal } from './CreateProjectModal';

interface ProjectSwitcherProps {
  collapsed?: boolean;
}

export const ProjectSwitcher: React.FC<ProjectSwitcherProps> = ({ collapsed = false }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const { activeProject, projects, selectProject, role } = useAuth();

  const handleSelect = (projectId: string) => {
    selectProject(projectId);
    setDropdownOpen(false);
  };

  if (!activeProject && projects.length === 0) return null;

  return (
    <div className="relative">
      {!collapsed ? (
        <div className="rounded border border-[#27272a] bg-[#09090b] p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#71717a]">
              Active Project
            </span>
            {activeProject && (
              <span className="font-mono text-[9px] text-[#10b981]">
                {activeProject.sandboxesCount ?? 0} sbx
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex h-7 w-full items-center justify-between gap-1.5 rounded px-1.5 text-left font-mono text-[12px] font-medium text-[#fafafa] hover:bg-[#18181b] transition-colors"
          >
            <span className="truncate">{activeProject ? activeProject.name : 'Select Project'}</span>
            <ChevronDown className="h-3 w-3 shrink-0 text-[#71717a]" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          title={`Project: ${activeProject?.name}`}
          className="mx-auto flex h-8 w-9 items-center justify-center rounded border border-[#27272a] bg-[#09090b] text-[#fafafa] hover:border-[#6366f1]"
        >
          <Folder className="h-4 w-4 text-[#a1a1aa]" />
        </button>
      )}

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)} aria-hidden="true" />
          <div className="absolute left-0 top-full z-40 mt-1 w-60 rounded-lg border border-[#27272a] bg-[#18181b] p-1.5 shadow-2xl overlay-elevation font-mono text-[11px]">
            <div className="px-2 py-1 text-[10px] text-[#71717a] uppercase tracking-wider border-b border-[#27272a]">
              Projects in Tenant
            </div>

            <div className="max-h-48 overflow-y-auto py-1 space-y-0.5">
              {projects.length === 0 ? (
                <div className="px-2 py-2 text-[10px] text-[#71717a]">No projects found</div>
              ) : (
                projects.map((p) => {
                  const isSelected = activeProject?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelect(p.id)}
                      className={`flex h-8 w-full items-center justify-between rounded px-2 text-left transition-colors ${
                        isSelected
                          ? 'bg-[#202024] text-[#fafafa] font-semibold'
                          : 'text-[#a1a1aa] hover:bg-[#111113] hover:text-[#fafafa]'
                      }`}
                    >
                      <div className="truncate">
                        <div>{p.name}</div>
                        <div className="text-[9px] text-[#71717a] truncate">{p.slug}</div>
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 text-[#10b981] shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>

            {canManageProjects(role) && (
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
                  <span>Create Project</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <CreateProjectModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} />
    </div>
  );
};
