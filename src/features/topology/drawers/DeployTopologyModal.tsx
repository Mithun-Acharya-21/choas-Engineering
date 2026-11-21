import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Layers,
  Rocket,
  Server,
  Shield,
  X,
  Zap,
} from 'lucide-react';
import { Sandbox } from '../../../types/domain/sandbox';
import { ServiceTopology, TopologyValidationResult } from '../../../types/domain/topology';

interface DeployTopologyModalProps {
  isOpen: boolean;
  onClose: () => void;
  topology: ServiceTopology;
  sandboxes: Sandbox[];
  validation: TopologyValidationResult | null;
  onDeploy: (sandboxId: string) => Promise<void>;
  isLoadingSandboxes?: boolean;
}

export const DeployTopologyModal: React.FC<DeployTopologyModalProps> = ({
  isOpen,
  onClose,
  topology,
  sandboxes,
  validation,
  onDeploy,
  isLoadingSandboxes = false,
}) => {
  const readySandboxes = sandboxes.filter((s) => s.status === 'READY');
  const [selectedSandboxId, setSelectedSandboxId] = useState<string>(readySandboxes[0]?.id || '');
  const [isDeploying, setIsDeploying] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [deployedSuccess, setDeployedSuccess] = useState(false);

  useEffect(() => {
    if (readySandboxes.length > 0 && !selectedSandboxId) {
      setSelectedSandboxId(readySandboxes[0].id);
    }
  }, [readySandboxes, selectedSandboxId]);

  if (!isOpen) return null;

  const isValid = validation?.isValid ?? true;
  const effectiveSandboxId = selectedSandboxId || readySandboxes[0]?.id || '';
  const targetSandbox = sandboxes.find((s) => s.id === effectiveSandboxId);

  const handleDeploy = async () => {
    if (!effectiveSandboxId || !isValid) return;

    setIsDeploying(true);
    setError(null);
    setDeployedSuccess(false);

    try {
      const isTestEnv =
        Boolean((import.meta as any)?.env?.MODE === 'test') ||
        Boolean((import.meta as any)?.env?.VITEST) ||
        (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test');
      setCurrentStep('Validating topology specification and container catalog...');
      await new Promise((r) => setTimeout(r, isTestEnv ? 0 : 400));

      setCurrentStep('Translating topology into Kubernetes Deployments with Toxiproxy sidecars...');
      await new Promise((r) => setTimeout(r, isTestEnv ? 0 : 500));

      setCurrentStep('Applying ClusterIP Services and ConfigMaps to namespace...');
      await onDeploy(effectiveSandboxId);

      setCurrentStep('All workloads verified and ready in sandbox namespace.');
      setDeployedSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Deployment failed');
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#111113] border border-[#27272a] rounded-lg shadow-2xl p-6 text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#27272a]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Deploy Topology to Sandbox</h2>
              <p className="text-xs text-zinc-400 font-mono">
                {topology.name} (v{topology.version})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDeploying}
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

        {deployedSuccess ? (
          <div className="mt-6 p-6 text-center space-y-3 bg-[#18181b] border border-emerald-800/40 rounded-lg">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 mx-auto flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-100">Topology Successfully Deployed</h3>
            <p className="text-xs text-zinc-400 font-mono max-w-sm mx-auto">
              All {topology.nodes.length} services have been provisioned in namespace{' '}
              <span className="text-indigo-400">{targetSandbox?.k8sNamespace}</span> with injected Toxiproxy sidecars.
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded transition"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-4 text-xs">
            {/* Sandbox Selection */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Target Kubernetes Sandbox <span className="text-red-400">*</span>
              </label>

              {isLoadingSandboxes ? (
                <div className="p-3 text-center text-zinc-500 font-mono">Loading active sandboxes...</div>
              ) : readySandboxes.length === 0 ? (
                <div className="p-3 rounded bg-amber-950/30 border border-amber-800/40 text-amber-200 text-[11px] font-mono">
                  No active READY sandboxes found in this project. Please provision an M3 sandbox before deploying this topology.
                </div>
              ) : (
                <select
                  value={selectedSandboxId}
                  onChange={(e) => setSelectedSandboxId(e.target.value)}
                  disabled={isDeploying}
                  className="w-full px-3 py-2 text-sm bg-[#18181b] border border-[#27272a] rounded text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono transition"
                >
                  {readySandboxes.map((sbx) => (
                    <option key={sbx.id} value={sbx.id}>
                      {sbx.name || sbx.id} ({sbx.k8sNamespace})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Validation & Workloads Summary */}
            <div className="p-3.5 rounded-lg bg-[#18181b] border border-[#27272a] space-y-2 text-[11px] font-mono text-zinc-400">
              <div className="flex items-center justify-between">
                <span>Topology Validation:</span>
                <span className={isValid ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                  {isValid ? 'VALID' : 'INVALID (Resolve errors first)'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Workloads to Deploy:</span>
                <span className="text-zinc-200">{topology.nodes.length} Microservices</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Injected Proxies:</span>
                <span className="text-indigo-400">Toxiproxy port 8080</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Security Profile:</span>
                <span className="text-emerald-400">Pod Security Baseline + Default-Deny</span>
              </div>
            </div>

            {/* In-Flight Progress Animation */}
            {isDeploying && (
              <div className="p-3.5 rounded-lg bg-[#18181b] border border-indigo-900/40 space-y-2">
                <div className="flex items-center gap-2 text-indigo-300 font-mono text-[11px]">
                  <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  <span>{currentStep}</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1 overflow-hidden">
                  <div className="bg-indigo-500 h-1 rounded-full animate-pulse w-3/4" />
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#27272a]">
              <button
                type="button"
                onClick={onClose}
                disabled={isDeploying}
                className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-[#18181b] rounded transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeploy}
                disabled={isDeploying || readySandboxes.length === 0 || !isValid}
                className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded shadow-lg shadow-indigo-600/20 transition flex items-center gap-2"
              >
                {isDeploying ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Deploying...</span>
                  </>
                ) : (
                  <>
                    <Rocket className="w-3.5 h-3.5" />
                    <span>Deploy Topology</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
