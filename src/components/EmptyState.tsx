import React from 'react';
import { Layers } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No active telemetry data',
  message = 'There are no active workloads or telemetry points matching the selected filters.',
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-[#27272a] p-12 text-center ${className}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#18181b] text-[#71717a]">
        <Layers className="h-5 w-5" />
      </div>
      <h3 className="mt-3 font-display text-[15px] font-semibold text-[#fafafa]">{title}</h3>
      <p className="mt-1 max-w-sm text-[12px] text-[#71717a]">{message}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded bg-[#6366f1] px-3.5 py-1.5 font-mono text-[11px] font-medium text-white hover:bg-[#4f46e5]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
