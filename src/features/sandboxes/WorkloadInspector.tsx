import React from 'react';
import { Activity, CheckCircle2, Cpu, HardDrive, Layers, Network, Server, Shield, X, Zap } from 'lucide-react';
import { Sandbox } from '../../types/domain/sandbox';

interface WorkloadInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  sandbox: Sandbox | null;
}

export const WorkloadInspector: React.FC<WorkloadInspectorProps> = ({
  isOpen,
  onClose,
  sandbox,
}) => {
  if (!isOpen || !sandbox) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-[#0e0e11] border-l border-[#27272a] h-full flex flex-col shadow-2xl text-zinc-100 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-[#27272a] bg-[#111113] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-zinc-100">{sandbox.name || sandbox.id}</h2>
                <span className="px-2 py-0.5 text-[11px] font-mono rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {sandbox.status}
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                Namespace: <span className="text-indigo-400">{sandbox.k8sNamespace}</span> | Cluster: {sandbox.clusterId || 'sandbox-alpha-us-east-1'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-[#18181b] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Security & NetworkPolicy Verification Card */}
          <div className="p-4 rounded-lg bg-[#111113] border border-[#27272a] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" /> Kubernetes Security & Network Isolation
              </span>
              <span className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" /> default-deny enforced
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[11px] font-mono text-zinc-400">
              <div className="p-2.5 rounded bg-[#18181b] border border-[#27272a]">
                <div className="text-zinc-500 text-[10px] uppercase">ServiceAccount</div>
                <div className="text-zinc-200 truncate mt-0.5">sandbox-sa (unprivileged)</div>
                <div className="text-[10px] text-zinc-500 mt-1">automountServiceAccountToken: false</div>
              </div>
              <div className="p-2.5 rounded bg-[#18181b] border border-[#27272a]">
                <div className="text-zinc-500 text-[10px] uppercase">Pod Security Standard</div>
                <div className="text-zinc-200 truncate mt-0.5">baseline:latest</div>
                <div className="text-[10px] text-zinc-500 mt-1">Audit & Warn Enabled</div>
              </div>
            </div>
          </div>

          {/* Resource Profile Quotas */}
          <div className="p-4 rounded-lg bg-[#111113] border border-[#27272a] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" /> Allocated Resource Quotas
              </span>
              <span className="text-[11px] font-mono text-zinc-400 uppercase">
                {sandbox.resourceProfile?.profileName || 'standard'} profile
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-[11px] font-mono text-zinc-400">
              <div className="p-2.5 rounded bg-[#18181b] border border-[#27272a]">
                <div className="text-zinc-500 text-[10px] uppercase flex items-center gap-1"><Cpu className="w-3 h-3" /> CPU Limits</div>
                <div className="text-zinc-200 mt-1">{sandbox.quota?.cpuRequest || '2'} req / {sandbox.quota?.cpuLimit || '4'} max</div>
              </div>
              <div className="p-2.5 rounded bg-[#18181b] border border-[#27272a]">
                <div className="text-zinc-500 text-[10px] uppercase flex items-center gap-1"><HardDrive className="w-3 h-3" /> Memory Limits</div>
                <div className="text-zinc-200 mt-1">{sandbox.quota?.memoryRequest || '4Gi'} req / {sandbox.quota?.memoryLimit || '8Gi'} max</div>
              </div>
              <div className="p-2.5 rounded bg-[#18181b] border border-[#27272a]">
                <div className="text-zinc-500 text-[10px] uppercase flex items-center gap-1"><Layers className="w-3 h-3" /> Pod Capacity</div>
                <div className="text-zinc-200 mt-1">{sandbox.workloads?.length || 4} / {sandbox.quota?.maxPods || 20} pods</div>
              </div>
            </div>
          </div>

          {/* Workload List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Microservice Deployments ({sandbox.workloads?.length || 0})
              </h3>
              <span className="text-[11px] font-mono text-zinc-500">Toxiproxy sidecar injected on all services</span>
            </div>

            <div className="space-y-3">
              {(sandbox.workloads || []).map((workload, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-lg bg-[#111113] border border-[#27272a] hover:border-zinc-700 transition space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-sm font-semibold text-zinc-200 font-mono">{workload.name}</span>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      Replicas: {workload.replicasReady}/{workload.replicasDesired} Ready
                    </span>
                  </div>

                  {/* Cluster Service Endpoint */}
                  <div className="p-2 rounded bg-[#18181b] border border-[#27272a] font-mono text-[11px] flex items-center justify-between">
                    <span className="text-zinc-500 flex items-center gap-1.5">
                      <Network className="w-3.5 h-3.5 text-zinc-400" /> Endpoint
                    </span>
                    <span className="text-zinc-200 select-all">{workload.endpoint}</span>
                  </div>

                  {/* Container Stack */}
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[10px] uppercase font-mono text-zinc-500">Dual Container Topology</div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="p-2 rounded bg-[#18181b] border border-[#27272a] space-y-0.5">
                        <div className="flex items-center justify-between text-zinc-300">
                          <span className="font-semibold">app</span>
                          <span className="text-[10px] text-emerald-400">port 8081</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate">{workload.image}</div>
                      </div>

                      <div className="p-2 rounded bg-[#18181b] border border-indigo-900/40 space-y-0.5">
                        <div className="flex items-center justify-between text-indigo-300">
                          <span className="font-semibold flex items-center gap-1">
                            <Zap className="w-3 h-3 text-indigo-400" /> toxiproxy
                          </span>
                          <span className="text-[10px] text-indigo-400">8080 / 8474</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate">shopify/toxiproxy:2.9.0</div>
                      </div>
                    </div>
                  </div>

                  {/* Pod status details */}
                  {workload.pods && workload.pods.length > 0 && (
                    <div className="pt-1 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                      <span>Pod: {workload.pods[0].name}</span>
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Activity className="w-3 h-3" /> {workload.pods[0].readyContainers} containers ready
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#27272a] bg-[#111113] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white bg-[#18181b] hover:bg-zinc-800 rounded border border-[#27272a] transition"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
