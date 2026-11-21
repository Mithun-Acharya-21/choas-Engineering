import React, { useState } from 'react';
import { Menu, OctagonAlert, Search, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { canExecuteChaos } from '../context/rbac';
import { CLUSTERS } from '../services/mock/mockData';
import { ClusterId, ScreenId, TimeRange } from '../types/telemetry';

interface TopBarProps {
  cluster: ClusterId;
  activeScreen: ScreenId;
  timeRange: TimeRange;
  onSelectTimeRange: (range: TimeRange) => void;
  runningFaultCount: number;
  onHaltAllFaults: () => void;
  onOpenCommandPalette: () => void;
  onOpenMobileNav: () => void;
  isMockData?: boolean;
}

const SCREEN_SLUGS: Record<ScreenId, string> = {
  telemetry: 'sandbox-telemetry-overview',
  chaos: 'chaos-fault-workbench',
  topology: 'sandbox-mesh-topology',
  logs: 'incident-telemetry-logs',
  settings: 'tenant-rbac-settings',
};

const RANGES: TimeRange[] = ['15m', '1h', '6h', '24h'];

export const TopBar: React.FC<TopBarProps> = ({
  cluster,
  activeScreen,
  timeRange,
  onSelectTimeRange,
  runningFaultCount,
  onHaltAllFaults,
  onOpenCommandPalette,
  onOpenMobileNav,
  isMockData = true,
}) => {
  const [confirmHalt, setConfirmHalt] = useState(false);
  const { role } = useAuth();
  const canExecute = canExecuteChaos(role);
  const clusterMeta = CLUSTERS.find((c) => c.id === cluster) ?? CLUSTERS[0];

  const handleHaltClick = () => {
    if (!confirmHalt) {
      setConfirmHalt(true);
      setTimeout(() => setConfirmHalt(false), 3500);
      return;
    }
    setConfirmHalt(false);
    onHaltAllFaults();
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-[#27272a] bg-[#09090b] px-4">
      {/* Left: Mobile drawer button + Monospace Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation menu"
          className="flex md:hidden h-8 w-8 items-center justify-center rounded border border-[#27272a] bg-[#18181b] text-[#a1a1aa] hover:text-[#fafafa]"
        >
          <Menu className="h-4 w-4" />
        </button>

        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.01em] min-w-0 overflow-hidden"
        >
          <span className="hidden sm:inline text-[#10b981] font-semibold whitespace-nowrap">
            {cluster}
          </span>
          <span className="hidden sm:inline text-[#27272a]">/</span>
          <span className="hidden lg:inline text-[#a1a1aa] whitespace-nowrap">{clusterMeta.mesh}</span>
          <span className="hidden lg:inline text-[#27272a]">/</span>
          <span className="truncate font-medium text-[#fafafa]">{SCREEN_SLUGS[activeScreen] ?? activeScreen}</span>
        </nav>

        {/* Sandbox Isolation Pill */}
        <span className="hidden sm:inline-flex items-center gap-1 rounded border border-[#10b981]/30 bg-[#10b981]/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[#10b981]">
          <ShieldCheck className="h-2.5 w-2.5" />
          SANDBOX ISOLATED
        </span>

        {/* Explicit Simulated Sample Data Pill */}
        {isMockData && (
          <span className="inline-flex items-center rounded border border-[#38bdf8]/30 bg-[#38bdf8]/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[#38bdf8]">
            SIMULATED SAMPLE DATA
          </span>
        )}
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Time Range Segmented Control */}
        <div
          className="hidden sm:flex items-center rounded border border-[#27272a] bg-[#111113] p-0.5"
          role="group"
          aria-label="Time window"
        >
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onSelectTimeRange(r)}
              className={`h-6 rounded-[3px] px-2 font-mono text-[11px] tabular-nums transition-colors whitespace-nowrap shrink-0 ${
                timeRange === r
                  ? 'bg-[#202024] text-[#fafafa]'
                  : 'text-[#71717a] hover:text-[#a1a1aa]'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Command Palette Trigger */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex h-8 items-center gap-2 rounded border border-[#27272a] bg-[#18181b] px-2.5 text-[12px] text-[#a1a1aa] hover:bg-[#202024] hover:text-[#fafafa] transition-colors whitespace-nowrap shrink-0"
        >
          <Search className="h-3.5 w-3.5 text-[#71717a]" />
          <span className="hidden md:inline">Command</span>
          <kbd className="rounded border border-[#27272a] bg-[#111113] px-1 font-mono text-[10px] text-[#71717a]">
            ⌘K
          </kbd>
        </button>

        {/* Emergency Kill Switch — only targets active sandbox experiments for users with chaos:execute */}
        {runningFaultCount > 0 && canExecute && (
          <button
            type="button"
            onClick={handleHaltClick}
            title="Emergency Kill Switch: Aborts all active faults in this sandbox"
            className={`flex h-8 items-center gap-1.5 rounded px-3 font-mono text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
              confirmHalt
                ? 'bg-[#f43f5e] text-white border border-[#f43f5e]'
                : 'border border-[#f43f5e]/70 bg-[#f43f5e]/10 text-[#f43f5e] hover:bg-[#f43f5e]/20'
            }`}
          >
            <OctagonAlert className="h-3.5 w-3.5 shrink-0" />
            <span>
              {confirmHalt ? `Confirm Sandbox Halt (${runningFaultCount})` : `Halt Sandbox Faults (${runningFaultCount})`}
            </span>
          </button>
        )}
      </div>
    </header>
  );
};
