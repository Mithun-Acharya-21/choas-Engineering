import React from 'react';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Flame,
  LogOut,
  Network,
  Pause,
  Play,
  Settings,
  Shield,
  Terminal,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ProjectSwitcher } from '../features/projects/ProjectSwitcher';
import { TenantSwitcher } from '../features/tenants/TenantSwitcher';
import { CLUSTERS } from '../services/mock/mockData';
import { ClusterId, ScreenId } from '../types/telemetry';

interface SidebarProps {
  activeScreen: ScreenId;
  onSelectScreen: (screen: ScreenId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  cluster: ClusterId;
  onSelectCluster: (cluster: ClusterId) => void;
  runningFaultCount: number;
  isLive: boolean;
  onToggleLive: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: { id: ScreenId; label: string; icon: React.ElementType; shortcut: string }[] = [
  { id: 'telemetry', label: 'Telemetry', icon: Activity, shortcut: '1' },
  { id: 'chaos', label: 'Chaos Lab', icon: Flame, shortcut: '2' },
  { id: 'topology', label: 'Topology', icon: Network, shortcut: '3' },
  { id: 'logs', label: 'Logs & Traces', icon: Terminal, shortcut: '4' },
  { id: 'settings', label: 'Settings', icon: Settings, shortcut: '5' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeScreen,
  onSelectScreen,
  collapsed,
  onToggleCollapse,
  cluster,
  onSelectCluster,
  runningFaultCount,
  isLive,
  onToggleLive,
  mobileOpen,
  onCloseMobile,
}) => {
  const { user, role, logout } = useAuth();

  const content = (
    <aside
      className={`flex h-full flex-col border-r border-[#27272a] bg-[#111113] transition-[width] duration-150 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Brand Row */}
      <div className="flex h-12 items-center justify-between border-b border-[#27272a] px-3.5">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#27272a] bg-[#18181b] text-[#c0c1ff]">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M8 1.5L14 5V11L8 14.5L2 11V5L8 1.5Z"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <circle cx="8" cy="8" r="2" fill="#6366f1" />
            </svg>
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-display text-[13px] font-semibold tracking-tight text-[#fafafa] truncate">
                ChaosEngine AI
              </span>
              <span className="font-mono text-[9px] text-[#71717a] uppercase tracking-wider">
                Obsidian Console
              </span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          className="hidden lg:flex h-6 w-6 items-center justify-center rounded text-[#71717a] hover:bg-[#202024] hover:text-[#fafafa] transition-colors"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Multi-Tenant Boundary & Workspace Selectors */}
      <div className="border-b border-[#27272a] p-2 space-y-2">
        <TenantSwitcher collapsed={collapsed} />
        <ProjectSwitcher collapsed={collapsed} />

        {/* Cluster Context Switcher (Strictly Sandbox Clusters) */}
        {!collapsed ? (
          <div className="rounded border border-[#27272a] bg-[#09090b] p-2">
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="cluster-select"
                className="block font-mono text-[9px] font-medium uppercase tracking-[0.04em] text-[#71717a]"
              >
                Sandbox Cluster
              </label>
              <span className="flex items-center gap-0.5 font-mono text-[9px] text-[#10b981]">
                <Shield className="h-2.5 w-2.5" />
                ISOLATED
              </span>
            </div>
            <select
              id="cluster-select"
              value={cluster}
              onChange={(e) => onSelectCluster(e.target.value as ClusterId)}
              className="h-7 w-full rounded border border-[#27272a] bg-[#111113] px-2 font-mono text-[11px] text-[#fafafa] focus:border-[#6366f1] focus:outline-none"
            >
              {CLUSTERS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapse}
            title={`Sandbox Cluster: ${cluster}`}
            className="mx-auto flex h-8 w-9 items-center justify-center rounded border border-[#10b981]/30 bg-[#09090b] font-mono text-[10px] text-[#10b981] hover:border-[#10b981]"
          >
            SBX
          </button>
        )}
      </div>

      {/* Primary Workspace Navigation */}
      <nav className="flex-1 space-y-1 p-2 overflow-y-auto" aria-label="Primary Workspace">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectScreen(item.id);
                onCloseMobile();
              }}
              title={collapsed ? `${item.label} (${item.shortcut})` : undefined}
              className={`group flex h-9 w-full items-center gap-2.5 rounded px-2.5 text-[13px] font-medium transition-colors ${
                isActive
                  ? 'bg-[#202024] text-[#fafafa]'
                  : 'text-[#a1a1aa] hover:bg-[#18181b] hover:text-[#fafafa]'
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 transition-colors ${
                  isActive ? 'text-[#6366f1]' : 'text-[#71717a] group-hover:text-[#fafafa]'
                }`}
              />
              {!collapsed && (
                <div className="flex flex-1 items-center justify-between overflow-hidden">
                  <span className="truncate">{item.label}</span>
                  {item.id === 'chaos' && runningFaultCount > 0 ? (
                    <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#f59e0b]/20 px-1 font-mono text-[10px] font-semibold text-[#f59e0b]">
                      {runningFaultCount}
                    </span>
                  ) : (
                    <kbd className="hidden font-mono text-[10px] text-[#71717a] group-hover:inline-block">
                      {item.shortcut}
                    </kbd>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / User Profile & Live Stream Toggle */}
      <div className="border-t border-[#27272a] p-2 space-y-2">
        {/* Live Stream Status */}
        {!collapsed ? (
          <div className="flex items-center justify-between rounded border border-[#27272a] bg-[#09090b] px-2.5 py-1.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                {isLive && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10b981] opacity-75" />
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    isLive ? 'bg-[#10b981]' : 'bg-[#71717a]'
                  }`}
                />
              </span>
              <span className="font-mono text-[11px] text-[#a1a1aa]">
                {isLive ? 'Live Engine' : 'Paused'}
              </span>
            </div>
            <button
              type="button"
              onClick={onToggleLive}
              className="flex h-6 w-6 items-center justify-center rounded text-[#a1a1aa] hover:bg-[#202024] hover:text-[#fafafa]"
              aria-label={isLive ? 'Pause live stream' : 'Resume live stream'}
            >
              {isLive ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggleLive}
            title={isLive ? 'Live 2s Stream (Click to pause)' : 'Paused (Click to stream)'}
            className="mx-auto flex h-8 w-9 items-center justify-center rounded border border-[#27272a] bg-[#09090b] text-[#a1a1aa] hover:text-[#fafafa]"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isLive ? 'bg-[#10b981]' : 'bg-[#71717a]'
              }`}
            />
          </button>
        )}

        {/* User Identity & Logout */}
        {user && (
          !collapsed ? (
            <div className="flex items-center justify-between rounded border border-[#27272a] bg-[#09090b] p-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#18181b] border border-[#27272a] text-[#6366f1]">
                  <UserIcon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[11px] font-medium text-[#fafafa] truncate">
                    {user.fullName || user.email.split('@')[0]}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[9px] text-[#71717a] truncate max-w-[90px]">
                      {user.email}
                    </span>
                    <span className="inline-block rounded bg-[#6366f1]/20 px-1 py-0.2 font-mono text-[8px] font-semibold text-[#818cf8]">
                      {role || 'Viewer'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                title="Sign out of console"
                aria-label="Sign out"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#71717a] hover:bg-[#202024] hover:text-[#f43f5e] transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={logout}
              title={`Signed in as ${user.email} (${role}). Click to logout.`}
              aria-label="Sign out"
              className="mx-auto flex h-8 w-9 items-center justify-center rounded border border-[#27272a] bg-[#09090b] text-[#71717a] hover:text-[#f43f5e]"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:flex shrink-0">{content}</div>

      {/* Mobile Off-Canvas Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/60" onClick={onCloseMobile} aria-hidden="true" />
          <div className="relative z-10 w-64">{content}</div>
        </div>
      )}
    </>
  );
};
