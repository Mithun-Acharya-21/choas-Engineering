import React, { useState } from 'react';
import { AlertCircle, Flame, Lock, Network, OctagonAlert, ShieldCheck, Terminal, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { canExecuteChaos } from '../context/rbac';
import { isAllowedSandboxNamespace } from '../features/chaos/safetyGuardrails';
import { ChaosExperiment, ServiceNode } from '../types/telemetry';
import { ConfirmationModal } from './ConfirmationModal';
import { StatusBadge } from './StatusBadge';

interface ServiceInspectorDrawerProps {
  service: ServiceNode | null;
  experiments: ChaosExperiment[];
  onClose: () => void;
  onQuickInjectLatency: (serviceId: string) => void;
  onHaltServiceFaults: (serviceId: string) => void;
  onOpenTopology: (serviceId: string) => void;
  onOpenLogs: (serviceName: string) => void;
}

export const ServiceInspectorDrawer: React.FC<ServiceInspectorDrawerProps> = ({
  service,
  experiments,
  onClose,
  onQuickInjectLatency,
  onHaltServiceFaults,
  onOpenTopology,
  onOpenLogs,
}) => {
  const [confirmQuickInject, setConfirmQuickInject] = useState(false);
  const { role } = useAuth();
  const canExecute = canExecuteChaos(role);

  if (!service) return null;

  const activeExps = experiments.filter(
    (e) => e.status === 'running' && e.targetServiceId === service.id
  );

  const isSandbox = isAllowedSandboxNamespace(service.namespace);

  const handleConfirmQuickInject = () => {
    onQuickInjectLatency(service.id);
    setConfirmQuickInject(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} aria-hidden="true" />
      <aside className="relative z-10 flex h-full w-full max-w-[400px] flex-col border-l border-[#27272a] bg-[#111113] p-5 overflow-y-auto overlay-elevation">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#27272a] pb-4">
          <div>
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.04em]">
              <span className="text-[#10b981] font-medium">{service.namespace}</span>
              <span className="text-[#27272a]">·</span>
              <span className="text-[#71717a]">{service.cluster}</span>
            </div>
            <h2 className="mt-1 font-mono text-[16px] font-semibold text-[#fafafa]">
              {service.name}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={service.status} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close service inspector"
              className="flex h-7 w-7 items-center justify-center rounded border border-[#27272a] bg-[#18181b] text-[#a1a1aa] hover:bg-[#202024] hover:text-[#fafafa]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Sandbox Safety Indicator */}
        <div className="mt-3 flex items-center justify-between rounded border border-[#10b981]/30 bg-[#10b981]/10 px-2.5 py-1.5 font-mono text-[11px] text-[#10b981]">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Sandbox Isolation Verified
          </span>
          <span className="text-[10px] text-[#a1a1aa]">Toxiproxy: 8474</span>
        </div>

        {/* Latency Percentiles */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded border border-[#27272a] bg-[#18181b] p-2.5">
            <span className="block font-mono text-[10px] text-[#71717a]">p50</span>
            <span className="font-mono text-[14px] font-medium text-[#fafafa] tabular-nums">
              {service.p50Ms.toFixed(1)}ms
            </span>
          </div>
          <div className="rounded border border-[#27272a] bg-[#18181b] p-2.5">
            <span className="block font-mono text-[10px] text-[#71717a]">p95</span>
            <span className="font-mono text-[14px] font-medium text-[#fafafa] tabular-nums">
              {service.p95Ms.toFixed(1)}ms
            </span>
          </div>
          <div className="rounded border border-[#27272a] bg-[#18181b] p-2.5">
            <span className="block font-mono text-[10px] text-[#71717a]">p99</span>
            <span
              className={`font-mono text-[14px] font-medium tabular-nums ${
                service.p99Ms > 200 ? 'text-[#f59e0b]' : 'text-[#fafafa]'
              }`}
            >
              {service.p99Ms.toFixed(1)}ms
            </span>
          </div>
        </div>

        {/* Operational Metrics */}
        <div className="mt-4 space-y-2.5 rounded border border-[#27272a] bg-[#18181b] p-3 text-[12px]">
          <div className="flex justify-between font-mono">
            <span className="text-[#71717a]">Workload Replicas</span>
            <span className="text-[#fafafa] tabular-nums">
              {service.podsReady} / {service.podsTotal} Ready
            </span>
          </div>
          <div className="flex justify-between font-mono">
            <span className="text-[#71717a]">Throughput</span>
            <span className="text-[#fafafa] tabular-nums">{service.rps.toLocaleString()} RPS</span>
          </div>
          <div className="flex justify-between font-mono">
            <span className="text-[#71717a]">Error Rate</span>
            <span
              className={`tabular-nums ${
                service.errorRatePct > 1 ? 'text-[#f43f5e] font-semibold' : 'text-[#fafafa]'
              }`}
            >
              {service.errorRatePct.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between font-mono">
            <span className="text-[#71717a]">CPU Allocation</span>
            <span className="text-[#fafafa] tabular-nums">{service.cpuPct}% of cgroup</span>
          </div>
          <div className="flex justify-between font-mono">
            <span className="text-[#71717a]">SLO Error Budget</span>
            <span className="text-[#10b981] tabular-nums">
              {service.sloBudgetRemainingPct.toFixed(1)}% remaining
            </span>
          </div>
          <div className="flex justify-between font-mono">
            <span className="text-[#71717a]">Mesh Ingress CIDR</span>
            <span className="text-[#a1a1aa]">{service.cidr}</span>
          </div>
        </div>

        {/* Active Chaos Experiments */}
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
              Active Sandbox Injections ({activeExps.length})
            </span>
            {activeExps.length > 0 && canExecute && (
              <button
                type="button"
                onClick={() => onHaltServiceFaults(service.id)}
                className="flex items-center gap-1 font-mono text-[10px] text-[#f43f5e] hover:underline"
              >
                <OctagonAlert className="h-3 w-3" />
                Halt All on Service
              </button>
            )}
          </div>

          <div className="mt-2 space-y-2">
            {activeExps.length === 0 ? (
              <div className="rounded border border-dashed border-[#27272a] p-3 text-center font-mono text-[11px] text-[#71717a]">
                Steady state: zero active faults in this pod
              </div>
            ) : (
              activeExps.map((e) => (
                <div
                  key={e.id}
                  className="rounded border border-[#f59e0b]/40 bg-[#18181b] p-2.5 font-mono text-[11px] fault-glow-amber"
                >
                  <div className="flex items-center justify-between text-[#fafafa] font-medium">
                    <span>{e.name}</span>
                    <span className="text-[#f59e0b]">{e.remainingSec}s rem</span>
                  </div>
                  <div className="mt-1 text-[#71717a] text-[10px]">
                    {e.faultType}: {e.magnitude} {e.magnitudeUnit} @ {e.blastRadiusPct}% blast
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 space-y-2 border-t border-[#27272a] pt-4">
          <button
            type="button"
            onClick={() => setConfirmQuickInject(true)}
            disabled={!isSandbox || !canExecute}
            title={!canExecute ? `Permission Denied: Your role [${role || 'Viewer'}] cannot inject chaos faults` : undefined}
            className="flex h-8 w-full items-center justify-center gap-2 rounded border border-[#f59e0b]/40 bg-[#f59e0b]/10 font-mono text-[11px] font-semibold text-[#f59e0b] hover:bg-[#f59e0b]/20 disabled:opacity-40 transition-colors"
          >
            {canExecute ? <Flame className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {canExecute ? 'Inject +200ms Latency (Sandbox)' : 'Inject Fault (Restricted)'}
          </button>

          <button
            type="button"
            onClick={() => onOpenTopology(service.id)}
            className="flex h-8 w-full items-center justify-center gap-2 rounded border border-[#27272a] bg-[#18181b] font-mono text-[11px] text-[#fafafa] hover:bg-[#202024]"
          >
            <Network className="h-3.5 w-3.5" />
            Inspect Mesh Dependencies
          </button>

          <button
            type="button"
            onClick={() => onOpenLogs(service.name)}
            className="flex h-8 w-full items-center justify-center gap-2 rounded border border-[#27272a] bg-[#18181b] font-mono text-[11px] text-[#fafafa] hover:bg-[#202024]"
          >
            <Terminal className="h-3.5 w-3.5" />
            Stream Pod Logs & Traces
          </button>
        </div>
      </aside>

      {/* Confirmation Modal for Quick Latency */}
      <ConfirmationModal
        open={confirmQuickInject}
        title="Confirm Sandbox Fault Injection"
        description="Inject +200ms latency on Toxiproxy ingress for this sandbox workload? This will trigger artificial delay on all downstream callers."
        targetService={service.name}
        targetNamespace={service.namespace}
        destructiveActionLabel="Confirm Injection"
        onConfirm={handleConfirmQuickInject}
        onCancel={() => setConfirmQuickInject(false)}
      />
    </div>
  );
};
