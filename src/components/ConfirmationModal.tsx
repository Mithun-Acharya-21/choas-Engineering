import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  open: boolean;
  title: string;
  description: string;
  targetService?: string;
  targetNamespace?: string;
  destructiveActionLabel?: string;
  isHighBlast?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  open,
  title,
  description,
  targetService,
  targetNamespace,
  destructiveActionLabel = 'Confirm Action',
  isHighBlast = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/75 backdrop-blur-xs" onClick={onCancel} aria-hidden="true" />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-lg border border-[#f43f5e]/40 bg-[#18181b] p-5 shadow-2xl overlay-elevation">
        <div className="flex items-start justify-between gap-3 border-b border-[#27272a] pb-3">
          <div className="flex items-center gap-2 text-[#f43f5e]">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <h3 className="font-display text-[15px] font-semibold text-[#fafafa]">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel confirmation"
            className="flex h-6 w-6 items-center justify-center rounded text-[#71717a] hover:bg-[#202024] hover:text-[#fafafa]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-3.5 space-y-3">
          <p className="text-[13px] text-[#a1a1aa] leading-relaxed">{description}</p>

          {(targetService || targetNamespace) && (
            <div className="rounded border border-[#27272a] bg-[#111113] p-2.5 font-mono text-[11px] space-y-1">
              {targetService && (
                <div className="flex justify-between">
                  <span className="text-[#71717a]">Target Service:</span>
                  <span className="text-[#fafafa] font-medium">{targetService}</span>
                </div>
              )}
              {targetNamespace && (
                <div className="flex justify-between">
                  <span className="text-[#71717a]">Sandbox Namespace:</span>
                  <span className="text-[#10b981] font-medium">{targetNamespace}</span>
                </div>
              )}
              {isHighBlast && (
                <div className="flex justify-between text-[#f59e0b]">
                  <span>Safety Guardrail:</span>
                  <span className="font-medium">High Blast Radius Confirmed</span>
                </div>
              )}
            </div>
          )}

          <div className="rounded border border-[#38bdf8]/20 bg-[#38bdf8]/5 p-2 font-mono text-[10px] text-[#38bdf8]">
            🛡️ SANDBOX GUARANTEE: Injected faults are strictly isolated to this sandbox namespace and will not leak to control plane or host workloads.
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-[#27272a] bg-[#111113] px-3 py-1.5 font-mono text-[11px] text-[#a1a1aa] hover:bg-[#202024] hover:text-[#fafafa]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex items-center gap-1.5 rounded bg-[#f43f5e] px-3.5 py-1.5 font-mono text-[11px] font-semibold text-white hover:bg-[#e11d48] transition-colors"
          >
            {destructiveActionLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
