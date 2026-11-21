import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Flame, Network, OctagonAlert, Pause, Play, Search, Terminal } from 'lucide-react';
import { ScreenId, ServiceNode } from '../types/telemetry';

interface CommandItem {
  id: string;
  label: string;
  hint: string;
  icon: React.ElementType;
  action: () => void;
  danger?: boolean;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  services: ServiceNode[];
  isLive: boolean;
  runningFaultCount: number;
  onNavigate: (screen: ScreenId) => void;
  onInspectService: (service: ServiceNode) => void;
  onToggleLive: () => void;
  onHaltAllFaults: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  services,
  isLive,
  runningFaultCount,
  onNavigate,
  onInspectService,
  onToggleLive,
  onHaltAllFaults,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
    }
  }, [open]);

  const items = useMemo<CommandItem[]>(() => {
    const base: CommandItem[] = [
      {
        id: 'nav-telemetry',
        label: 'Go to Telemetry Overview',
        hint: 'Screen 1',
        icon: Activity,
        action: () => onNavigate('telemetry'),
      },
      {
        id: 'nav-chaos',
        label: 'Go to Chaos Fault Lab',
        hint: 'Screen 2',
        icon: Flame,
        action: () => onNavigate('chaos'),
      },
      {
        id: 'nav-topology',
        label: 'Go to Service Mesh Topology',
        hint: 'Screen 3',
        icon: Network,
        action: () => onNavigate('topology'),
      },
      {
        id: 'nav-logs',
        label: 'Go to Incident & Chaos Log Streams',
        hint: 'Screen 4',
        icon: Terminal,
        action: () => onNavigate('logs'),
      },
      {
        id: 'toggle-stream',
        label: isLive ? 'Pause Live Telemetry Stream' : 'Resume Live Telemetry Stream',
        hint: 'Stream',
        icon: isLive ? Pause : Play,
        action: onToggleLive,
      },
    ];

    if (runningFaultCount > 0) {
      base.unshift({
        id: 'halt-all',
        label: `Emergency Halt All Active Faults (${runningFaultCount})`,
        hint: 'Kill Switch',
        icon: OctagonAlert,
        action: onHaltAllFaults,
        danger: true,
      });
    }

    services.forEach((svc) => {
      base.push({
        id: `svc-${svc.id}`,
        label: `Inspect ${svc.name}`,
        hint: `${svc.namespace} · p99 ${svc.p99Ms.toFixed(0)}ms`,
        icon: Network,
        action: () => onInspectService(svc),
      });
    });

    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (item) =>
        item.label.toLowerCase().includes(q) || item.hint.toLowerCase().includes(q)
    );
  }, [query, services, isLive, runningFaultCount, onNavigate, onInspectService, onToggleLive, onHaltAllFaults]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(items.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter' && items[selectedIdx]) {
        e.preventDefault();
        items[selectedIdx].action();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, items, selectedIdx, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] px-4">
      <div className="fixed inset-0 bg-black/75" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-lg border border-[#27272a] bg-[#202024] overlay-elevation"
      >
        <div className="flex items-center gap-2.5 border-b border-[#27272a] px-3.5 py-2.5">
          <Search className="h-4 w-4 text-[#71717a]" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            placeholder="Jump to screen, inspect service, or run command..."
            className="w-full bg-transparent font-mono text-[13px] text-[#fafafa] placeholder:text-[#71717a] focus:outline-none"
          />
          <kbd className="rounded border border-[#27272a] bg-[#111113] px-1.5 py-0.5 font-mono text-[10px] text-[#71717a]">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5">
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center font-mono text-[12px] text-[#71717a]">
              No matching commands.
            </div>
          ) : (
            items.map((item, idx) => {
              const Icon = item.icon;
              const active = idx === selectedIdx;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setSelectedIdx(idx)}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  className={`flex w-full items-center justify-between rounded px-3 py-2 text-left transition-colors ${
                    active ? 'bg-[#6366f1]/20 text-[#fafafa]' : 'text-[#a1a1aa] hover:bg-[#18181b]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`h-3.5 w-3.5 shrink-0 ${
                        item.danger ? 'text-[#f43f5e]' : active ? 'text-[#c0c1ff]' : 'text-[#71717a]'
                      }`}
                    />
                    <span
                      className={`truncate text-[13px] ${
                        item.danger ? 'text-[#f43f5e] font-medium' : 'text-[#fafafa]'
                      }`}
                    >
                      {item.label}
                    </span>
                  </span>
                  <span className="shrink-0 pl-3 font-mono text-[11px] text-[#71717a]">
                    {item.hint}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
