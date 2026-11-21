import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  Plus,
  RefreshCw,
  Server,
  Shield,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { canOperateSandboxes } from '../../context/rbac';
import { sandboxService } from '../../services/api/sandboxService';
import { mockSandboxService } from '../../services/mock/mockSandboxService';
import { Sandbox, SandboxCreatePayload } from '../../types/domain/sandbox';
import { CreateSandboxModal } from './CreateSandboxModal';
import { TerminateSandboxModal } from './TerminateSandboxModal';
import { WorkloadInspector } from './WorkloadInspector';

export const SandboxManagementScreen: React.FC = () => {
  const { activeTenant, activeProject, role, isMockMode } = useAuth();
  const service = isMockMode ? mockSandboxService : sandboxService;

  const [sandboxes, setSandboxes] = useState<Sandbox[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileReport, setReconcileReport] = useState<string | null>(null);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [sandboxToTerminate, setSandboxToTerminate] = useState<Sandbox | null>(null);
  const [inspectedSandbox, setInspectedSandbox] = useState<Sandbox | null>(null);

  const canOperate = canOperateSandboxes(role);

  // Load sandboxes scoped to active project
  const fetchSandboxes = useCallback(async (isMountedCheck?: () => boolean) => {
    try {
      setError(null);
      const data = await service.listSandboxes(activeProject?.id);
      if (!isMountedCheck || isMountedCheck()) {
        setSandboxes(data);
      }
    } catch (err: any) {
      if (!isMountedCheck || isMountedCheck()) {
        setError(err?.message || 'Failed to load sandboxes');
      }
    } finally {
      if (!isMountedCheck || isMountedCheck()) {
        setIsLoading(false);
      }
    }
  }, [service, activeProject?.id]);

  useEffect(() => {
    let isMounted = true;
    fetchSandboxes(() => isMounted);
    return () => {
      isMounted = false;
    };
  }, [fetchSandboxes]);

  // Polling watchdog: poll every 2 seconds if any sandbox is transitioning
  const hasTransitioning = useMemo(() => {
    return sandboxes.some(
      (s) =>
        s.status === 'PENDING' ||
        s.status === 'PROVISIONING' ||
        s.status === 'TERMINATING'
    );
  }, [sandboxes]);

  useEffect(() => {
    if (!hasTransitioning) return;
    const interval = setInterval(() => {
      fetchSandboxes();
    }, 2000);
    return () => clearInterval(interval);
  }, [hasTransitioning, fetchSandboxes]);

  // Handle Provisioning
  const handleProvision = async (payload: SandboxCreatePayload, idempotencyKey: string) => {
    await service.provisionSandbox(payload, idempotencyKey);
    await fetchSandboxes();
  };

  // Handle Teardown
  const handleTerminate = async (sandboxId: string) => {
    await service.deleteSandbox(sandboxId);
    await fetchSandboxes();
  };

  // Handle Reconcile
  const handleReconcile = async () => {
    setIsReconciling(true);
    setReconcileReport(null);
    try {
      const res = await service.reconcile();
      setReconcileReport(
        `Watchdog run complete: ${res.stuck_sandboxes_recovered} stuck recovered, ${res.expired_sandboxes_terminated} expired purged, ${res.orphaned_namespaces_purged} orphaned cleaned.`
      );
      await fetchSandboxes();
    } catch (err: any) {
      setReconcileReport(`Reconciliation error: ${err.message}`);
    } finally {
      setIsReconciling(false);
    }
  };

  // Aggregated Statistics
  const stats = useMemo(() => {
    const total = sandboxes.length;
    const ready = sandboxes.filter((s) => s.status === 'READY').length;
    const provisioning = sandboxes.filter(
      (s) => s.status === 'PROVISIONING' || s.status === 'PENDING'
    ).length;
    const failed = sandboxes.filter((s) => s.status === 'FAILED').length;
    return { total, ready, provisioning, failed };
  }, [sandboxes]);

  return (
    <div className="p-6 space-y-6 text-zinc-100 min-h-screen bg-[#09090b]">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-[#27272a]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-400" /> Dynamic Kubernetes Sandboxes
            </h1>
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              M3 Production Engine
            </span>
            {isMockMode && (
              <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Mock Sim Active
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 font-mono mt-1">
            Tenant: <span className="text-zinc-200">{activeTenant?.name || 'Loading...'}</span> |
            Project: <span className="text-zinc-200">{activeProject?.name || 'All Projects'}</span> |
            Role: <span className="text-indigo-400">{role || 'Viewer'}</span>
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleReconcile}
            disabled={isReconciling}
            title="Trigger watchdog reconciliation pass"
            className="px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-[#18181b] hover:bg-zinc-800 rounded border border-[#27272a] transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReconciling ? 'animate-spin' : ''}`} />
            <span>Reconcile</span>
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            disabled={!canOperate}
            title={canOperate ? 'Provision a new isolated sandbox' : 'Viewer role cannot provision sandboxes'}
            className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded shadow-lg shadow-indigo-600/20 transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Provision Sandbox</span>
          </button>
        </div>
      </div>

      {/* Reconcile Flash Report */}
      {reconcileReport && (
        <div className="p-3 rounded bg-indigo-950/30 border border-indigo-800/40 text-xs font-mono text-indigo-300 flex items-center justify-between">
          <span>{reconcileReport}</span>
          <button onClick={() => setReconcileReport(null)} className="text-zinc-400 hover:text-white text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Error Callout */}
      {error && (
        <div className="p-4 rounded bg-red-950/40 border border-red-800/50 flex items-start gap-2.5 text-xs text-red-200">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Statistics Overview Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-[#111113] border border-[#27272a] space-y-1">
          <div className="text-[11px] font-mono text-zinc-500 uppercase">Total Sandboxes</div>
          <div className="text-2xl font-bold font-mono text-white">{stats.total}</div>
        </div>

        <div className="p-4 rounded-lg bg-[#111113] border border-[#27272a] space-y-1">
          <div className="text-[11px] font-mono text-emerald-500 uppercase flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Ready & Isolated
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">{stats.ready}</div>
        </div>

        <div className="p-4 rounded-lg bg-[#111113] border border-[#27272a] space-y-1">
          <div className="text-[11px] font-mono text-indigo-400 uppercase flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" /> Provisioning
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-300 flex items-center gap-2">
            {stats.provisioning}
            {stats.provisioning > 0 && (
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
            )}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-[#111113] border border-[#27272a] space-y-1">
          <div className="text-[11px] font-mono text-red-400 uppercase flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> Failed / Error
          </div>
          <div className="text-2xl font-bold font-mono text-red-400">{stats.failed}</div>
        </div>
      </div>

      {/* Sandboxes List / Table */}
      <div className="rounded-lg bg-[#111113] border border-[#27272a] overflow-hidden">
        <div className="p-4 border-b border-[#27272a] flex items-center justify-between">
          <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-zinc-400" /> Active Environments ({sandboxes.length})
          </h2>
          <button
            onClick={() => fetchSandboxes()}
            className="text-xs text-zinc-400 hover:text-zinc-200 font-mono flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-zinc-500 flex flex-col items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading sandboxes from Kubernetes cluster...</span>
          </div>
        ) : sandboxes.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#18181b] border border-[#27272a] mx-auto flex items-center justify-center text-zinc-500">
              <Server className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-200">No Sandboxes Provisioned</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Provision an isolated Kubernetes sandbox to deploy sample microservices and inject controlled chaos experiments.
            </p>
            {canOperate && (
              <button
                onClick={() => setIsCreateOpen(true)}
                className="mt-2 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded shadow transition"
              >
                Provision First Sandbox
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#27272a]">
            {sandboxes.map((sbx) => {
              const isProvisioning = sbx.status === 'PROVISIONING' || sbx.status === 'PENDING';
              const isReady = sbx.status === 'READY';
              const isFailed = sbx.status === 'FAILED';
              const isTerminating = sbx.status === 'TERMINATING';

              return (
                <div key={sbx.id} className="p-4 hover:bg-[#151518] transition space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-zinc-100 font-mono">
                          {sbx.name || sbx.id}
                        </span>

                        {/* Status Badge */}
                        <span
                          className={`px-2 py-0.5 text-[11px] font-mono rounded border flex items-center gap-1.5 ${
                            isReady
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : isProvisioning
                              ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 animate-pulse'
                              : isFailed
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isReady
                                ? 'bg-emerald-400'
                                : isProvisioning
                                ? 'bg-indigo-400'
                                : isFailed
                                ? 'bg-red-400'
                                : 'bg-zinc-400'
                            }`}
                          />
                          {sbx.status}
                        </span>

                        {/* Network Isolation Pill */}
                        {sbx.isIsolated && (
                          <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 flex items-center gap-1">
                            <Shield className="w-3 h-3 text-emerald-400" /> default-deny
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-zinc-400">
                        <span>
                          Namespace: <span className="text-indigo-400">{sbx.k8sNamespace}</span>
                        </span>
                        <span>
                          Cluster: <span className="text-zinc-300">{sbx.clusterId || 'sandbox-alpha-us-east-1'}</span>
                        </span>
                        <span>
                          Workloads: <span className="text-zinc-200">{sbx.workloads?.length || 4} Deployments</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-zinc-500" />
                          Expires: {new Date(sbx.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setInspectedSandbox(sbx)}
                        className="px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-[#18181b] hover:bg-zinc-800 rounded border border-[#27272a] transition flex items-center gap-1.5"
                      >
                        <Layers className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Inspect</span>
                      </button>

                      <button
                        onClick={() => setSandboxToTerminate(sbx)}
                        disabled={!canOperate || isTerminating}
                        title={canOperate ? 'Terminate sandbox' : 'Viewer role cannot terminate sandboxes'}
                        className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-900/30 rounded border border-red-800/40 transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Terminate</span>
                      </button>
                    </div>
                  </div>

                  {/* Provisioning Progress Bar */}
                  {isProvisioning && (
                    <div className="mt-2 space-y-1.5 p-3 rounded bg-[#18181b] border border-indigo-900/30">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-indigo-300 flex items-center gap-1.5">
                          <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                          {sbx.currentStep || 'Applying Kubernetes manifests...'}
                        </span>
                        <span className="text-indigo-400 font-semibold">
                          {sbx.progressPercentage ?? 50}%
                        </span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${sbx.progressPercentage ?? 50}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Error Summary if Failed */}
                  {isFailed && sbx.errorSummary && (
                    <div className="mt-2 p-2.5 rounded bg-red-950/30 border border-red-800/40 text-[11px] font-mono text-red-300">
                      Error: {sbx.errorSummary}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateSandboxModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleProvision}
        projectId={activeProject?.id || 'default-proj'}
        projectName={activeProject?.name}
      />

      <TerminateSandboxModal
        isOpen={!!sandboxToTerminate}
        onClose={() => setSandboxToTerminate(null)}
        onConfirm={handleTerminate}
        sandbox={sandboxToTerminate}
      />

      <WorkloadInspector
        isOpen={!!inspectedSandbox}
        onClose={() => setInspectedSandbox(null)}
        sandbox={inspectedSandbox}
      />
    </div>
  );
};
