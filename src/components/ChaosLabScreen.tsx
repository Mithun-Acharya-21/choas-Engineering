import React, { useMemo, useState } from 'react';
import { AlertCircle, Flame, Lock, OctagonAlert, Play, RotateCcw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { canExecuteChaos } from '../context/rbac';
import { isAllowedSandboxNamespace, validateExperimentSafety } from '../features/chaos/safetyGuardrails';
import { FAULT_TYPE_META } from '../services/mock/mockData';
import { ChaosExperiment, ClusterId, FaultType, ServiceNode } from '../types/telemetry';
import { ConfirmationModal } from './ConfirmationModal';
import { StatusBadge } from './StatusBadge';

interface ChaosLabScreenProps {
  cluster: ClusterId;
  services: ServiceNode[];
  experiments: ChaosExperiment[];
  onLaunchExperiment: (payload: {
    name: string;
    targetServiceId: string;
    faultType: FaultType;
    magnitude: number;
    blastRadiusPct: number;
    durationSec: number;
    hypothesis: string;
  }) => void;
  onHaltExperiment: (experimentId: string) => void;
  onInspectService: (service: ServiceNode) => void;
}

function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const ChaosLabScreen: React.FC<ChaosLabScreenProps> = ({
  cluster,
  services,
  experiments,
  onLaunchExperiment,
  onHaltExperiment,
  onInspectService,
}) => {
  const { role } = useAuth();
  const canExecute = canExecuteChaos(role);

  const [targetId, setTargetId] = useState<string>(services[2]?.id ?? services[0]?.id ?? '');
  const [faultType, setFaultType] = useState<FaultType>('latency');
  const [magnitude, setMagnitude] = useState<number>(FAULT_TYPE_META.latency.defaultVal);
  const [blastRadiusPct, setBlastRadiusPct] = useState<number>(30);
  const [durationSec, setDurationSec] = useState<number>(300);
  const [expName, setExpName] = useState<string>('');
  const [hypothesis, setHypothesis] = useState<string>(
    'Downstream retries stay bounded and circuit breaker isolates p99 spike within 5s.'
  );
  const [filterTab, setFilterTab] = useState<'all' | 'running' | 'completed' | 'halted'>('all');
  const [confirmHaltId, setConfirmHaltId] = useState<string | null>(null);

  // Safety confirmation dialog state
  const [pendingLaunchPayload, setPendingLaunchPayload] = useState<{
    name: string;
    targetServiceId: string;
    faultType: FaultType;
    magnitude: number;
    blastRadiusPct: number;
    durationSec: number;
    hypothesis: string;
  } | null>(null);

  const meta = FAULT_TYPE_META[faultType];
  const selectedService = services.find((s) => s.id === targetId) ?? services[0];

  // Run safety validation
  const safetyCheck = useMemo(() => {
    if (!selectedService) return null;
    return validateExperimentSafety(selectedService, cluster, blastRadiusPct);
  }, [selectedService, cluster, blastRadiusPct]);

  const handleFaultTypeChange = (nextType: FaultType) => {
    setFaultType(nextType);
    setMagnitude(FAULT_TYPE_META[nextType].defaultVal);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;

    // RBAC check: Only TenantOwner and Engineer can execute chaos experiments
    if (!canExecute) {
      alert(`Permission Denied: Your role [${role || 'Viewer'}] does not possess 'chaos:execute' permission.`);
      return;
    }

    // Safety blocking: if there are critical security errors, abort
    if (safetyCheck && safetyCheck.errors.length > 0) {
      alert(`Experiment Blocked by Safety Guardrails:\n${safetyCheck.errors.join('\n')}`);
      return;
    }

    const autoName =
      expName.trim() ||
      `sbx-${selectedService.name}-${faultType.replace('_', '-')}-${magnitude}${meta.unit.replace('/', '-')}`;

    const payload = {
      name: autoName,
      targetServiceId: selectedService.id,
      faultType,
      magnitude,
      blastRadiusPct,
      durationSec,
      hypothesis: hypothesis.trim() || 'Steady-state SLO remains within error budget.',
    };

    // Require explicit confirmation if blast radius >= 50% or destructive fault
    if (blastRadiusPct >= 50 || faultType === 'pod_kill' || faultType === 'dns_blackhole') {
      setPendingLaunchPayload(payload);
    } else {
      onLaunchExperiment(payload);
      setExpName('');
    }
  };

  const handleConfirmLaunch = () => {
    if (pendingLaunchPayload) {
      onLaunchExperiment(pendingLaunchPayload);
      setPendingLaunchPayload(null);
      setExpName('');
    }
  };

  const filteredExperiments = useMemo(() => {
    return experiments.filter((exp) => filterTab === 'all' || exp.status === filterTab);
  }, [experiments, filterTab]);

  const runningCount = experiments.filter((e) => e.status === 'running').length;

  return (
    <div className="mx-auto max-w-[1440px] space-y-4 p-4 lg:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-[#fafafa]">
              Chaos Fault Lab
            </h1>
            <span className="flex items-center gap-1 rounded border border-[#10b981]/30 bg-[#10b981]/10 px-2 py-0.5 font-mono text-[10px] text-[#10b981]">
              <ShieldCheck className="h-3 w-3" />
              SANDBOX RESTRICTED
            </span>
          </div>
          <p className="mt-0.5 font-mono text-[11px] text-[#a1a1aa] tabular-nums">
            <span>{cluster}</span>
            <span className="mx-1.5 text-[#27272a]">·</span>
            <span>{runningCount} active sandbox injections</span>
            <span className="mx-1.5 text-[#27272a]">·</span>
            <span>blast guardrails armed</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left: Fault Injection Workbench (5 cols) */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 rounded-lg border border-[#27272a] bg-[#18181b] p-4 space-y-4 self-start"
        >
          <div className="flex items-center justify-between border-b border-[#27272a] pb-3">
            <div>
              <h2 className="font-display text-[15px] font-semibold text-[#fafafa]">
                Inject Sandbox Fault
              </h2>
              <p className="text-[12px] text-[#a1a1aa]">
                Targets Toxiproxy sidecars within isolated sandbox namespaces
              </p>
            </div>
            <Flame className="h-4 w-4 text-[#f59e0b]" />
          </div>

          {/* Safety Status Banner */}
          {safetyCheck && safetyCheck.errors.length > 0 && (
            <div className="rounded border border-[#f43f5e]/40 bg-[#f43f5e]/10 p-2.5 font-mono text-[11px] text-[#f43f5e] space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>SAFETY GUARDRAIL BLOCKED:</span>
              </div>
              {safetyCheck.errors.map((err, i) => (
                <div key={i}>• {err}</div>
              ))}
            </div>
          )}

          {/* Target Service Selector */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label
                htmlFor="chaos-target-svc"
                className="block font-mono text-[11px] text-[#a1a1aa]"
              >
                Target Sandbox Service
              </label>
              {selectedService && (
                <span className="font-mono text-[10px] text-[#10b981]">
                  ns: {selectedService.namespace}
                </span>
              )}
            </div>
            <select
              id="chaos-target-svc"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="h-8 w-full rounded border border-[#27272a] bg-[#111113] px-2.5 font-mono text-[12px] text-[#fafafa] focus:border-[#6366f1] focus:outline-none"
            >
              {services.map((s) => {
                const isAllowed = isAllowedSandboxNamespace(s.namespace);
                return (
                  <option key={s.id} value={s.id} disabled={!isAllowed}>
                    {s.name} ({s.namespace}) {!isAllowed ? '[BLOCKED: NON-SANDBOX]' : ''} — {s.podsReady}/{s.podsTotal} pods
                  </option>
                );
              })}
            </select>
          </div>

          {/* Fault Vector Grid */}
          <div>
            <span className="mb-2 block font-mono text-[11px] text-[#a1a1aa]">
              Fault Injection Vector
            </span>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {(Object.keys(FAULT_TYPE_META) as FaultType[]).map((f) => {
                const fMeta = FAULT_TYPE_META[f];
                const active = faultType === f;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => handleFaultTypeChange(f)}
                    className={`rounded border p-2 text-left transition-colors ${
                      active
                        ? 'border-[#6366f1] bg-[#6366f1]/10 text-[#fafafa]'
                        : 'border-[#27272a] bg-[#111113] text-[#a1a1aa] hover:border-[#3f3f46]'
                    }`}
                  >
                    <span className="block font-mono text-[11px] font-medium leading-tight">
                      {fMeta.label}
                    </span>
                    <span className="mt-0.5 block font-mono text-[10px] text-[#71717a]">
                      {fMeta.unit}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 font-mono text-[10px] text-[#71717a]">{meta.desc}</p>
          </div>

          {/* Magnitude Slider */}
          <div>
            <div className="flex items-center justify-between font-mono text-[11px]">
              <label htmlFor="chaos-magnitude" className="text-[#a1a1aa]">
                Fault Intensity
              </label>
              <span className="font-semibold text-[#fafafa] tabular-nums">
                {magnitude} {meta.unit}
              </span>
            </div>
            <input
              id="chaos-magnitude"
              type="range"
              min={meta.min}
              max={meta.max}
              step={meta.step}
              value={magnitude}
              onChange={(e) => setMagnitude(Number(e.target.value))}
              className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[#27272a] accent-[#6366f1]"
            />
            <div className="mt-1 flex justify-between font-mono text-[9px] text-[#71717a] tabular-nums">
              <span>{meta.min} {meta.unit}</span>
              <span>{meta.max} {meta.unit}</span>
            </div>
          </div>

          {/* Blast Radius Slider */}
          <div>
            <div className="flex items-center justify-between font-mono text-[11px]">
              <label htmlFor="chaos-blast-radius" className="text-[#a1a1aa]">
                Blast Radius
              </label>
              <span className={`font-semibold tabular-nums ${blastRadiusPct >= 50 ? 'text-[#f59e0b]' : 'text-[#fafafa]'}`}>
                {blastRadiusPct}% of mesh traffic {blastRadiusPct >= 50 ? '(High Blast)' : ''}
              </span>
            </div>
            <input
              id="chaos-blast-radius"
              type="range"
              min={5}
              max={100}
              step={5}
              value={blastRadiusPct}
              onChange={(e) => setBlastRadiusPct(Number(e.target.value))}
              className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[#27272a] accent-[#6366f1]"
            />
          </div>

          {/* Duration Selector */}
          <div>
            <span className="mb-1.5 block font-mono text-[11px] text-[#a1a1aa]">
              Execution Duration
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {[60, 180, 300, 600].map((dur) => (
                <button
                  key={dur}
                  type="button"
                  onClick={() => setDurationSec(dur)}
                  className={`rounded border py-1.5 font-mono text-[11px] tabular-nums transition-colors ${
                    durationSec === dur
                      ? 'border-[#6366f1] bg-[#6366f1]/15 text-[#fafafa]'
                      : 'border-[#27272a] bg-[#111113] text-[#71717a] hover:border-[#3f3f46]'
                  }`}
                >
                  {dur >= 60 ? `${dur / 60}m` : `${dur}s`}
                </button>
              ))}
            </div>
          </div>

          {/* Experiment Hypothesis */}
          <div>
            <label htmlFor="chaos-hypothesis" className="mb-1.5 block font-mono text-[11px] text-[#a1a1aa]">
              Resilience Hypothesis
            </label>
            <textarea
              id="chaos-hypothesis"
              rows={2}
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              className="w-full rounded border border-[#27272a] bg-[#111113] p-2 font-mono text-[11px] text-[#fafafa] focus:border-[#6366f1] focus:outline-none"
              placeholder="What steady state should the architecture preserve?"
            />
          </div>

          {/* RBAC Notice for Viewers */}
          {!canExecute && (
            <div className="flex items-center gap-2 rounded border border-[#f59e0b]/30 bg-[#f59e0b]/10 p-2.5 font-mono text-[11px] text-[#f59e0b]">
              <Lock className="h-4 w-4 shrink-0" />
              <span>Viewer Role is read-only. Elevated membership required to launch chaos faults.</span>
            </div>
          )}

          {/* Launch Action */}
          <button
            type="submit"
            disabled={!canExecute || (safetyCheck ? safetyCheck.errors.length > 0 : false)}
            title={!canExecute ? `Permission Denied: Your role [${role || 'Viewer'}] is read-only` : undefined}
            className="flex h-9 w-full items-center justify-center gap-2 rounded bg-[#f59e0b] px-3 font-mono text-[12px] font-semibold text-[#09090b] hover:bg-[#d97706] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {canExecute ? <Play className="h-3.5 w-3.5 fill-current" /> : <Lock className="h-3.5 w-3.5" />}
            {canExecute ? 'Launch Sandbox Experiment' : 'Launch Restricted (Read-Only)'}
          </button>
        </form>

        {/* Right: Experiments Monitor (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          {/* Tabs Filter */}
          <div className="flex items-center justify-between border-b border-[#27272a] pb-2">
            <div className="flex items-center gap-1">
              {(['all', 'running', 'completed', 'halted'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilterTab(tab)}
                  className={`rounded px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.04em] transition-colors ${
                    filterTab === tab
                      ? 'bg-[#202024] text-[#fafafa]'
                      : 'text-[#71717a] hover:text-[#a1a1aa]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <span className="font-mono text-[11px] text-[#71717a]">
              {filteredExperiments.length} experiments in active sandbox
            </span>
          </div>

          {/* Experiment List */}
          <div className="space-y-2.5">
            {filteredExperiments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#27272a] p-8 text-center font-mono text-[12px] text-[#71717a]">
                No experiments match filter '{filterTab}'
              </div>
            ) : (
              filteredExperiments.map((exp) => {
                const isRunning = exp.status === 'running';
                const progressPct = isRunning
                  ? Math.max(0, Math.min(100, ((exp.durationSec - exp.remainingSec) / exp.durationSec) * 100))
                  : 100;

                return (
                  <div
                    key={exp.id}
                    className={`rounded-lg border bg-[#18181b] p-3.5 transition-all ${
                      isRunning ? 'border-[#f59e0b]/40 fault-glow-amber' : 'border-[#27272a]'
                    }`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={exp.status} />
                          <span className="font-mono text-[11px] text-[#71717a]">{exp.id}</span>
                          <span className="font-mono text-[10px] text-[#10b981]">
                            {exp.targetNamespace ?? 'sandbox-checkout'}
                          </span>
                        </div>
                        <h3 className="mt-1 font-mono text-[14px] font-semibold text-[#fafafa] truncate">
                          {exp.name}
                        </h3>
                        <p className="mt-1 font-mono text-[11px] text-[#a1a1aa] leading-snug">
                          {exp.hypothesis}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isRunning && canExecute && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirmHaltId === exp.id) {
                                onHaltExperiment(exp.id);
                                setConfirmHaltId(null);
                              } else {
                                setConfirmHaltId(exp.id);
                                setTimeout(() => setConfirmHaltId((curr) => (curr === exp.id ? null : curr)), 3000);
                              }
                            }}
                            className={`flex h-7 items-center gap-1.5 rounded px-2.5 font-mono text-[11px] font-medium transition-colors ${
                              confirmHaltId === exp.id
                                ? 'bg-[#f43f5e] text-white'
                                : 'border border-[#f43f5e]/60 bg-[#f43f5e]/10 text-[#f43f5e] hover:bg-[#f43f5e]/20'
                            }`}
                          >
                            <OctagonAlert className="h-3 w-3" />
                            {confirmHaltId === exp.id ? 'Confirm Halt' : 'Halt'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar for Running Experiments */}
                    {isRunning && (
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between font-mono text-[10px] text-[#a1a1aa] tabular-nums">
                          <span>Elapsed {Math.round(progressPct)}%</span>
                          <span className="text-[#f59e0b] font-medium">
                            {formatCountdown(exp.remainingSec)} remaining
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#27272a]">
                          <div
                            className="h-full bg-[#f59e0b] transition-all duration-1000"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Explicit Safety Confirmation Modal */}
      <ConfirmationModal
        open={pendingLaunchPayload !== null}
        title="Confirm High-Impact Sandbox Fault"
        description="You are injecting an experiment with a high blast radius or replica termination into the isolated sandbox environment."
        targetService={selectedService?.name}
        targetNamespace={selectedService?.namespace}
        destructiveActionLabel="Proceed & Inject Fault"
        isHighBlast={blastRadiusPct >= 50}
        onConfirm={handleConfirmLaunch}
        onCancel={() => setPendingLaunchPayload(null)}
      />
    </div>
  );
};
