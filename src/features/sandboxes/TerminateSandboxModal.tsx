import React, { useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Sandbox } from '../../types/domain/sandbox';

interface TerminateSandboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (sandboxId: string) => Promise<void>;
  sandbox: Sandbox | null;
}

export const TerminateSandboxModal: React.FC<TerminateSandboxModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  sandbox,
}) => {
  const [confirmName, setConfirmName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !sandbox) return null;

  const targetName = sandbox.name || sandbox.id;
  const isMatch = confirmName.trim() === targetName;

  const handleConfirm = async () => {
    if (!isMatch) return;
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm(sandbox.id);
      setConfirmName('');
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to terminate sandbox');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-md bg-[#111113] border border-red-900/40 rounded-lg shadow-2xl p-6 text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#27272a]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Terminate Sandbox</h2>
              <p className="text-xs text-zinc-400 font-mono">Irreversible Kubernetes Teardown</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-[#18181b] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded bg-red-950/40 border border-red-800/50 text-xs text-red-200">
            {error}
          </div>
        )}

        <div className="mt-4 space-y-4 text-xs text-zinc-300">
          <p>
            You are about to permanently delete the Kubernetes sandbox{' '}
            <span className="font-semibold text-white font-mono">{targetName}</span> and all associated resources:
          </p>

          <div className="p-3 rounded bg-[#18181b] border border-[#27272a] space-y-1.5 font-mono text-[11px] text-zinc-400">
            <div>• Namespace: <span className="text-red-400">{sandbox.k8sNamespace}</span></div>
            <div>• Workloads: <span className="text-zinc-200">{sandbox.workloads?.length || 4} Deployments</span></div>
            <div>• Sidecars: <span className="text-zinc-200">Toxiproxy instances purged</span></div>
            <div>• NetworkPolicy & RBAC: <span className="text-zinc-200">Removed</span></div>
          </div>

          <div className="space-y-1.5 pt-2">
            <label className="block text-zinc-400">
              To confirm, type <span className="font-mono text-white font-semibold">{targetName}</span>:
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={targetName}
              disabled={isDeleting}
              className="w-full px-3 py-2 text-sm bg-[#18181b] border border-[#27272a] rounded text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-red-500 font-mono transition"
            />
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[#27272a]">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-[#18181b] rounded transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isMatch || isDeleting}
            className="px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed rounded shadow-lg shadow-red-600/20 transition flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Terminating...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Teardown</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
