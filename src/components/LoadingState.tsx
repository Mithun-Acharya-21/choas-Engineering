import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading telemetry & sandbox metrics...',
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-12 text-center ${className}`}>
      <Loader2 className="h-6 w-6 animate-spin text-[#6366f1]" />
      <p className="mt-3 font-mono text-[12px] text-[#a1a1aa]">{message}</p>
    </div>
  );
};
