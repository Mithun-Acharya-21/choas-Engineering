import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to load telemetry',
  message = 'An unexpected error occurred while communicating with the telemetry collector.',
  onRetry,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center rounded-lg border border-[#f43f5e]/30 bg-[#f43f5e]/5 p-8 text-center ${className}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f43f5e]/15 text-[#f43f5e]">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h3 className="mt-3 font-display text-[15px] font-semibold text-[#fafafa]">{title}</h3>
      <p className="mt-1 max-w-md font-mono text-[12px] text-[#a1a1aa]">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 flex items-center gap-1.5 rounded border border-[#27272a] bg-[#18181b] px-3 py-1.5 font-mono text-[11px] text-[#fafafa] hover:bg-[#202024]"
        >
          <RefreshCw className="h-3 w-3" />
          Retry Connection
        </button>
      )}
    </div>
  );
};
