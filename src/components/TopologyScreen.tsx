import React, { useMemo, useState } from 'react';
import { Flame, Lock, Maximize2, OctagonAlert, ShieldCheck, Terminal, ZoomIn, ZoomOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { canExecuteChaos } from '../context/rbac';
import { ChaosExperiment, ServiceNode } from '../types/telemetry';
import { ConfirmationModal } from './ConfirmationModal';
import { StatusBadge } from './StatusBadge';

interface TopologyScreenProps {
  services: ServiceNode[];
  experiments: ChaosExperiment[];
  selectedServiceId: string;
  onSelectServiceId: (id: string) => void;
  onQuickInjectLatency: (serviceId: string) => void;
  onHaltServiceFaults: (serviceId: string) => void;
  onViewLogsForService: (serviceName: string) => void;
}

const NODE_W = 196;
const NODE_H = 84;

export const TopologyScreen: React.FC<TopologyScreenProps> = ({
  services,
  experiments,
  selectedServiceId,
  onSelectServiceId,
  onQuickInjectLatency,
  onHaltServiceFaults,
  onViewLogsForService,
}) => {
  const [zoom, setZoom] = useState(1);
  const [tierFilter, setTierFilter] = useState<'all' | 'ingress' | 'compute' | 'data'>('all');
  const [confirmQuickService, setConfirmQuickService] = useState<ServiceNode | null>(null);
  const { role } = useAuth();
  const canExecute = canExecuteChaos(role);

  const selectedService =
    services.find((s) => s.id === selectedServiceId) ?? services[0];

  const upstreamCallers = useMemo(
    () => services.filter((s) => s.dependencies.includes(selectedService.id)),
    [services, selectedService]
  );

  const downstreamDeps = useMemo(
    () => services.filter((s) => selectedService.dependencies.includes(s.id)),
    [services, selectedService]
  );

  const activeNodeExperiments = useMemo(
    () =>
      experiments.filter(
        (e) => e.status === 'running' && e.targetServiceId === selectedService.id
      ),
    [experiments, selectedService]
  );

  const edges = useMemo(() => {
    const list: { from: ServiceNode; to: ServiceNode }[] = [];
    services.forEach((src) => {
      src.dependencies.forEach((depId) => {
        const dst = services.find((s) => s.id === depId);
        if (dst) list.push({ from: src, to: dst });
      });
    });
    return list;
  }, [services]);

  const statusBorder = (svc: ServiceNode, isSelected: boolean) => {
    if (svc.status === 'critical') return '#f43f5e';
    if (svc.status === 'injecting') return '#f59e0b';
    if (isSelected) return '#6366f1';
    return '#27272a';
  };

  const handleConfirmQuickInject = () => {
    if (confirmQuickService) {
      onQuickInjectLatency(confirmQuickService.id);
      setConfirmQuickService(null);
    }
  };

  return (
    <div className="flex h-[calc(100vh-48px)] flex-col xl:flex-row overflow-hidden">
      {/* Left: Interactive Mesh Graph Canvas */}
      <div className="relative flex-1 overflow-auto bg-[#09090b] p-4">
        {/* Top Floating Controls */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-[20px] font-semibold tracking-[-0.02em] text-[#fafafa]">
                Service Mesh Topology
              </h1>
              <span className="flex items-center gap-1 rounded border border-[#10b981]/30 bg-[#10b981]/10 px-1.5 py-0.5 font-mono text-[9px] text-[#10b981]">
                <ShieldCheck className="h-2.5 w-2.5" />
                SANDBOX ISOLATED
              </span>
            </div>
            <p className="font-mono text-[11px] text-[#71717a]">
              Click any node to inspect upstream callers, pod saturation, and fault blasts
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Tier Highlight */}
            <div className="flex items-center rounded border border-[#27272a] bg-[#111113] p-0.5">
              {(['all', 'ingress', 'compute', 'data'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setTierFilter(tier)}
                  className={`h-6 rounded-[3px] px-2 font-mono text-[10px] uppercase tracking-[0.04em] transition-colors whitespace-nowrap shrink-0 ${
                    tierFilter === tier
                      ? 'bg-[#202024] text-[#fafafa]'
                      : 'text-[#71717a] hover:text-[#a1a1aa]'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center rounded border border-[#27272a] bg-[#18181b]">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.7, Number((z - 0.1).toFixed(1))))}
                aria-label="Zoom out"
                className="flex h-7 w-7 items-center justify-center border-r border-[#27272a] text-[#a1a1aa] hover:bg-[#202024] hover:text-[#fafafa]"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="px-2 font-mono text-[11px] text-[#a1a1aa] tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(1.3, Number((z + 0.1).toFixed(1))))}
                aria-label="Zoom in"
                className="flex h-7 w-7 items-center justify-center border-l border-[#27272a] text-[#a1a1aa] hover:bg-[#202024] hover:text-[#fafafa]"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* 2D Node-Edge Canvas */}
        <div
          className="relative min-h-[580px] min-w-[1100px] rounded-lg border border-[#27272a] bg-[#0c0c0e] p-6 transition-transform duration-100 origin-top-left"
          style={{ transform: `scale(${zoom})` }}
        >
          {/* SVG Dependency Edges */}
          <svg className="absolute inset-0 h-full w-full pointer-events-none" aria-hidden="true">
            <defs>
              <marker
                id="arrowhead-default"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#3f3f46" />
              </marker>
              <marker
                id="arrowhead-active"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#f59e0b" />
              </marker>
            </defs>
            {edges.map(({ from, to }, idx) => {
              const x1 = from.position.x + NODE_W;
              const y1 = from.position.y + NODE_H / 2;
              const x2 = to.position.x;
              const y2 = to.position.y + NODE_H / 2;
              const dx = x2 - x1;
              const cx1 = x1 + dx * 0.45;
              const cx2 = x2 - dx * 0.45;
              const isDegraded = from.status !== 'healthy' || to.status !== 'healthy';

              return (
                <path
                  key={`${from.id}-${to.id}-${idx}`}
                  d={`M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={isDegraded ? '#f59e0b' : '#27272a'}
                  strokeWidth={isDegraded ? 2 : 1.2}
                  strokeDasharray={isDegraded ? '4 3' : undefined}
                  markerEnd={isDegraded ? 'url(#arrowhead-active)' : 'url(#arrowhead-default)'}
                />
              );
            })}
          </svg>

          {/* Service Nodes */}
          {services.map((svc) => {
            const isSelected = svc.id === selectedServiceId;
            const isDimmed = tierFilter !== 'all' && svc.tier !== tierFilter;
            const isTargeted = experiments.some((e) => e.status === 'running' && e.targetServiceId === svc.id);

            return (
              <div
                key={svc.id}
                onClick={() => onSelectServiceId(svc.id)}
                style={{
                  left: svc.position.x,
                  top: svc.position.y,
                  width: NODE_W,
                  borderColor: statusBorder(svc, isSelected),
                }}
                className={`absolute cursor-pointer rounded-lg border bg-[#18181b] p-2.5 transition-all select-none hover:border-[#6366f1] ${
                  isDimmed ? 'opacity-30' : 'opacity-100'
                } ${isSelected ? 'ring-2 ring-[#6366f1]/30 shadow-lg' : ''} ${
                  isTargeted ? 'fault-glow-amber' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-[10px] text-[#10b981] truncate">{svc.namespace}</span>
                  <StatusBadge status={svc.status} />
                </div>
                <h3 className="mt-1 font-mono text-[13px] font-semibold text-[#fafafa] truncate">
                  {svc.name}
                </h3>
                <div className="mt-2 flex items-center justify-between border-t border-[#27272a] pt-1.5 font-mono text-[10px] text-[#a1a1aa] tabular-nums">
                  <span>p99: {svc.p99Ms.toFixed(0)}ms</span>
                  <span>err: {svc.errorRatePct.toFixed(2)}%</span>
                  <span>{svc.podsReady}/{svc.podsTotal}p</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Selected Node Detail Inspector */}
      <aside className="w-full xl:w-80 shrink-0 border-t xl:border-t-0 xl:border-l border-[#27272a] bg-[#111113] p-4 overflow-y-auto">
        <div className="flex items-start justify-between border-b border-[#27272a] pb-3">
          <div>
            <span className="font-mono text-[10px] text-[#10b981] uppercase">{selectedService.namespace}</span>
            <h2 className="font-mono text-[16px] font-semibold text-[#fafafa]">{selectedService.name}</h2>
          </div>
          <StatusBadge status={selectedService.status} />
        </div>

        {/* Action Buttons */}
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => setConfirmQuickService(selectedService)}
            disabled={!canExecute}
            title={!canExecute ? `Permission Denied: Your role [${role || 'Viewer'}] is read-only` : undefined}
            className="flex h-8 w-full items-center justify-center gap-1.5 rounded border border-[#f59e0b]/40 bg-[#f59e0b]/10 font-mono text-[11px] font-semibold text-[#f59e0b] hover:bg-[#f59e0b]/20 disabled:opacity-40 transition-colors"
          >
            {canExecute ? <Flame className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {canExecute ? 'Inject +200ms Latency (Sandbox)' : 'Inject Latency (Restricted)'}
          </button>

          {activeNodeExperiments.length > 0 && canExecute && (
            <button
              type="button"
              onClick={() => onHaltServiceFaults(selectedService.id)}
              className="flex h-8 w-full items-center justify-center gap-1.5 rounded border border-[#f43f5e]/40 bg-[#f43f5e]/10 font-mono text-[11px] text-[#f43f5e] hover:bg-[#f43f5e]/20"
            >
              <OctagonAlert className="h-3.5 w-3.5" />
              Halt Active Faults on Node
            </button>
          )}

          <button
            type="button"
            onClick={() => onViewLogsForService(selectedService.name)}
            className="flex h-8 w-full items-center justify-center gap-1.5 rounded border border-[#27272a] bg-[#18181b] font-mono text-[11px] text-[#fafafa] hover:bg-[#202024]"
          >
            <Terminal className="h-3.5 w-3.5" />
            Stream Pod Logs
          </button>
        </div>

        {/* Upstream Callers */}
        <div className="mt-5">
          <span className="font-mono text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider">
            Upstream Callers ({upstreamCallers.length})
          </span>
          <div className="mt-1.5 space-y-1">
            {upstreamCallers.length === 0 ? (
              <span className="font-mono text-[10px] text-[#71717a] block">Edge ingress root (none)</span>
            ) : (
              upstreamCallers.map((up) => (
                <div
                  key={up.id}
                  onClick={() => onSelectServiceId(up.id)}
                  className="cursor-pointer rounded border border-[#27272a] bg-[#18181b] p-2 hover:border-[#6366f1] flex justify-between items-center"
                >
                  <span className="font-mono text-[11px] text-[#fafafa]">{up.name}</span>
                  <StatusBadge status={up.status} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Downstream Dependencies */}
        <div className="mt-5">
          <span className="font-mono text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider">
            Downstream Dependencies ({downstreamDeps.length})
          </span>
          <div className="mt-1.5 space-y-1">
            {downstreamDeps.length === 0 ? (
              <span className="font-mono text-[10px] text-[#71717a] block">Leaf datastore (none)</span>
            ) : (
              downstreamDeps.map((down) => (
                <div
                  key={down.id}
                  onClick={() => onSelectServiceId(down.id)}
                  className="cursor-pointer rounded border border-[#27272a] bg-[#18181b] p-2 hover:border-[#6366f1] flex justify-between items-center"
                >
                  <span className="font-mono text-[11px] text-[#fafafa]">{down.name}</span>
                  <StatusBadge status={down.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Confirmation Modal */}
      <ConfirmationModal
        open={confirmQuickService !== null}
        title="Confirm Sandbox Fault Injection"
        description="Inject +200ms latency on Toxiproxy ingress for this sandbox workload? This will trigger artificial delay on all downstream callers."
        targetService={confirmQuickService?.name}
        targetNamespace={confirmQuickService?.namespace}
        destructiveActionLabel="Confirm Injection"
        onConfirm={handleConfirmQuickInject}
        onCancel={() => setConfirmQuickService(null)}
      />
    </div>
  );
};
