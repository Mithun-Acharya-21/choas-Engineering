import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Clock, Cpu, HardDrive, Layers, Server, Shield, X } from 'lucide-react';
import { SandboxCreatePayload } from '../../types/domain/sandbox';

interface CreateSandboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: SandboxCreatePayload, idempotencyKey: string) => Promise<void>;
  projectId: string;
  projectName?: string;
}

export const CreateSandboxModal: React.FC<CreateSandboxModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  projectId,
  projectName,
}) => {
  const [name, setName] = useState('');
  const [clusterId, setClusterId] = useState('sandbox-alpha-us-east-1');
  const [profile, setProfile] = useState<'standard' | 'stress_lab'>('standard');
  const [ttlHours, setTtlHours] = useState(4);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Sandbox name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const idempotencyKey = `idem-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const payload: SandboxCreatePayload = {
      name: name.trim(),
      projectId,
      clusterId,
      topologyId: 'topo-ecommerce-default',
      ttlHours,
      resourceProfile:
        profile === 'standard'
          ? {
              profile_name: 'standard',
              cpu_request: '2',
              cpu_limit: '4',
              memory_request: '4Gi',
              memory_limit: '8Gi',
              max_pods: 20,
            }
          : {
              profile_name: 'stress_lab',
              cpu_request: '4',
              cpu_limit: '8',
              memory_request: '8Gi',
              memory_limit: '16Gi',
              max_pods: 40,
            },
    };

    try {
      await onSubmit(payload, idempotencyKey);
      if (typeof window !== 'undefined') {
        setName('');
        onClose();
      }
    } catch (err: any) {
      if (typeof window !== 'undefined') {
        setError(err?.response?.data?.detail || err?.message || 'Failed to provision sandbox');
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl bg-[#111113] border border-[#27272a] rounded-lg shadow-2xl p-6 text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#27272a]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Provision Kubernetes Sandbox</h2>
              <p className="text-xs text-zinc-400 font-mono">
                Project: {projectName || projectId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-[#18181b] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded bg-red-950/40 border border-red-800/50 flex items-start gap-2.5 text-xs text-red-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Sandbox Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Sandbox Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. checkout-chaos-lab-01"
              maxLength={64}
              required
              disabled={isSubmitting}
              className="w-full px-3 py-2 text-sm bg-[#18181b] border border-[#27272a] rounded text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-mono transition"
            />
            <p className="mt-1 text-[11px] text-zinc-500 font-mono">
              Namespace will be strictly server-generated as: <span className="text-indigo-400">sandbox-{'{tenant}'}-{'{hash}'}</span>
            </p>
          </div>

          {/* Target Cluster */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Kubernetes Cluster
            </label>
            <select
              value={clusterId}
              onChange={(e) => setClusterId(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3 py-2 text-sm bg-[#18181b] border border-[#27272a] rounded text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono transition"
            >
              <option value="sandbox-alpha-us-east-1">sandbox-alpha-us-east-1 (Kind Local Development)</option>
              <option value="sandbox-beta-eu-west-1">sandbox-beta-eu-west-1 (Dedicated Sandbox Pool)</option>
            </select>
          </div>

          {/* Resource Profile Selection */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Resource Profile & Limits
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setProfile('standard')}
                className={`p-3 rounded-lg border cursor-pointer transition ${
                  profile === 'standard'
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-[#27272a] bg-[#18181b] hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200">Standard Lab</span>
                  {profile === 'standard' && <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />}
                </div>
                <div className="mt-2 space-y-1 text-[11px] text-zinc-400 font-mono">
                  <div className="flex items-center gap-1.5"><Cpu className="w-3 h-3 text-zinc-500" /> 2 / 4 CPU Cores</div>
                  <div className="flex items-center gap-1.5"><HardDrive className="w-3 h-3 text-zinc-500" /> 4Gi / 8Gi Memory</div>
                  <div className="flex items-center gap-1.5"><Layers className="w-3 h-3 text-zinc-500" /> Max 20 Pods</div>
                </div>
              </div>

              <div
                onClick={() => setProfile('stress_lab')}
                className={`p-3 rounded-lg border cursor-pointer transition ${
                  profile === 'stress_lab'
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-[#27272a] bg-[#18181b] hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-200">Stress Lab</span>
                  {profile === 'stress_lab' && <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />}
                </div>
                <div className="mt-2 space-y-1 text-[11px] text-zinc-400 font-mono">
                  <div className="flex items-center gap-1.5"><Cpu className="w-3 h-3 text-zinc-500" /> 4 / 8 CPU Cores</div>
                  <div className="flex items-center gap-1.5"><HardDrive className="w-3 h-3 text-zinc-500" /> 8Gi / 16Gi Memory</div>
                  <div className="flex items-center gap-1.5"><Layers className="w-3 h-3 text-zinc-500" /> Max 40 Pods</div>
                </div>
              </div>
            </div>
          </div>

          {/* TTL Slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-400" /> Auto-Teardown TTL
              </label>
              <span className="text-xs font-mono text-indigo-400 font-medium">{ttlHours} Hours</span>
            </div>
            <input
              type="range"
              min="1"
              max="24"
              step="1"
              value={ttlHours}
              onChange={(e) => setTtlHours(Number(e.target.value))}
              disabled={isSubmitting}
              className="w-full accent-indigo-500 bg-[#18181b] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono mt-1">
              <span>1h (Quick Test)</span>
              <span>4h (Standard)</span>
              <span>24h (Max Extended)</span>
            </div>
          </div>

          {/* Security Guarantee Callout */}
          <div className="p-3 rounded bg-[#18181b] border border-[#27272a] flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-zinc-400 space-y-1">
              <span className="font-semibold text-zinc-300">Automated Security Invariants:</span>
              <p>
                Strict default-deny NetworkPolicy applied, unprivileged ServiceAccount bound, and dual-container Toxiproxy sidecars injected automatically.
              </p>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#27272a]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-[#18181b] rounded transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="submit-provision-modal-btn"
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded shadow-lg shadow-indigo-600/20 transition flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Provisioning...</span>
                </>
              ) : (
                <>
                  <Server className="w-3.5 h-3.5" />
                  <span>Provision Sandbox</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
