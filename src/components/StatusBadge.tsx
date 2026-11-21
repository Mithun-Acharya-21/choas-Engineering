import React from 'react';
import { LogLevel, ServiceStatus } from '../types/telemetry';

type BadgeVariant =
  | ServiceStatus
  | 'running'
  | 'completed'
  | 'halted'
  | LogLevel;

interface StatusBadgeProps {
  status: BadgeVariant;
  className?: string;
}

const STYLES: Record<
  BadgeVariant,
  { bg: string; text: string; border: string; label: string; dotColor?: string; pulse?: boolean }
> = {
  healthy: {
    bg: 'bg-[#10b981]/10',
    text: 'text-[#10b981]',
    border: 'border-[#10b981]/25',
    label: 'HEALTHY',
    dotColor: 'bg-[#10b981]',
  },
  injecting: {
    bg: 'bg-[#f59e0b]/10',
    text: 'text-[#f59e0b]',
    border: 'border-[#f59e0b]/30',
    label: 'INJECTING',
    dotColor: 'bg-[#f59e0b]',
    pulse: true,
  },
  critical: {
    bg: 'bg-[#f43f5e]/10',
    text: 'text-[#f43f5e]',
    border: 'border-[#f43f5e]/35',
    label: 'CRITICAL',
    dotColor: 'bg-[#f43f5e]',
    pulse: true,
  },
  running: {
    bg: 'bg-[#f59e0b]/10',
    text: 'text-[#f59e0b]',
    border: 'border-[#f59e0b]/30',
    label: 'RUNNING',
    dotColor: 'bg-[#f59e0b]',
    pulse: true,
  },
  completed: {
    bg: 'bg-[#10b981]/10',
    text: 'text-[#10b981]',
    border: 'border-[#10b981]/25',
    label: 'COMPLETED',
  },
  halted: {
    bg: 'bg-[#71717a]/15',
    text: 'text-[#a1a1aa]',
    border: 'border-[#27272a]',
    label: 'HALTED',
  },
  INFO: {
    bg: 'bg-[#38bdf8]/10',
    text: 'text-[#38bdf8]',
    border: 'border-[#38bdf8]/25',
    label: 'INFO',
  },
  WARN: {
    bg: 'bg-[#f59e0b]/10',
    text: 'text-[#f59e0b]',
    border: 'border-[#f59e0b]/25',
    label: 'WARN',
  },
  CRIT: {
    bg: 'bg-[#f43f5e]/12',
    text: 'text-[#f43f5e]',
    border: 'border-[#f43f5e]/35',
    label: 'CRIT',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const cfg = STYLES[status];
  return (
    <span
      className={`inline-flex h-5 items-center gap-1.5 rounded border px-1.5 font-mono text-[10px] font-medium tracking-[0.04em] whitespace-nowrap shrink-0 ${cfg.bg} ${cfg.text} ${cfg.border} ${className}`}
    >
      {cfg.dotColor && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          {cfg.pulse && (
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${cfg.dotColor}`}
            />
          )}
          <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${cfg.dotColor}`} />
        </span>
      )}
      {cfg.label}
    </span>
  );
};
