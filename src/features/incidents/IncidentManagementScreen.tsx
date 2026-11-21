import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Flame,
  GitBranch,
  Info,
  Layers,
  Play,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Sparkles,
  Workflow,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { canManageIncidents } from '../../context/rbac';
import { RCAInvestigationWorkspace } from '../rca/RCAInvestigationWorkspace';
import { incidentService } from '../../services/api/incidentService';
import { mockIncidentService } from '../../services/mock/mockIncidentService';
import {
  IncidentEvidencePackage,
  IncidentLifecycleEvent,
  IncidentRecord,
  IncidentSeverity,
  IncidentStatus,
} from '../../types/domain/incident';

export const IncidentManagementScreen: React.FC = () => {
  const navigate = useNavigate();
  const { role, isMockMode, activeProject } = useAuth();
  const service = isMockMode ? mockIncidentService : incidentService;

  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Incident for Detail Drawer
  const [selectedIncident, setSelectedIncident] = useState<IncidentRecord | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<IncidentLifecycleEvent[]>([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<'overview' | 'topology' | 'evidence' | 'experiment' | 'rca'>('overview');

  // Transition Note
  const [transitionAction, setTransitionAction] = useState<IncidentStatus | null>(null);
  const [transitionNote, setTransitionNote] = useState('');
  const [isSubmittingTransition, setIsSubmittingTransition] = useState(false);

  // Manual Evaluation Trigger
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<string | null>(null);

  const canManage = canManageIncidents(role);

  // Load Incidents
  const fetchIncidents = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await service.listIncidents();
      setIncidents(res.items || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch incident catalog');
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  // Load Timeline when an incident is selected
  const fetchTimeline = useCallback(async (incidentId: string) => {
    try {
      setIsLoadingTimeline(true);
      const events = await service.getTimeline(incidentId);
      setTimelineEvents(events);
    } catch (err: any) {
      console.error('Failed to load incident timeline', err);
    } finally {
      setIsLoadingTimeline(false);
    }
  }, [service]);

  const handleSelectIncident = (incident: IncidentRecord) => {
    setSelectedIncident(incident);
    setActiveDrawerTab('overview');
    setTransitionAction(null);
    setTransitionNote('');
    fetchTimeline(incident.id);
  };

  // Run Manual Detection Evaluation
  const handleRunEvaluation = async () => {
    setIsEvaluating(true);
    setEvaluationResult(null);
    try {
      const sandboxId = 'sbx-prod-sandbox-01';
      const projectId = activeProject?.id || 'proj-ecommerce-demo';
      const res = await service.evaluateIncidents(sandboxId, projectId);
      setEvaluationResult(
        `Evaluation complete: ${res.breachesDetected ?? 0} breaches evaluated, ` +
        `${res.incidentsCreated ?? 0} created, ${res.incidentsUpdated ?? 0} updated, ` +
        `${res.incidentsAutoResolved ?? 0} auto-resolved.`
      );
      await fetchIncidents();
      if (selectedIncident) {
        const updated = await service.getIncident(selectedIncident.id);
        setSelectedIncident(updated);
        fetchTimeline(selectedIncident.id);
      }
    } catch (err: any) {
      setError(err?.message || 'Evaluation run failed');
    } finally {
      setIsEvaluating(false);
    }
  };

  // Execute Lifecycle Transition
  const handleExecuteTransition = async (targetStatus: IncidentStatus) => {
    if (!selectedIncident || !canManage) return;
    setIsSubmittingTransition(true);
    try {
      let updated: IncidentRecord;
      const note = transitionNote.trim() || undefined;

      switch (targetStatus) {
        case 'ACKNOWLEDGED':
          updated = await service.acknowledgeIncident(selectedIncident.id, note);
          break;
        case 'INVESTIGATING':
          updated = await service.investigateIncident(selectedIncident.id, note);
          break;
        case 'RESOLVED':
          updated = await service.resolveIncident(selectedIncident.id, note);
          break;
        case 'CLOSED':
          updated = await service.closeIncident(selectedIncident.id, note);
          break;
        default:
          throw new Error(`Unsupported direct transition to ${targetStatus}`);
      }

      setSelectedIncident(updated);
      setTransitionAction(null);
      setTransitionNote('');
      await fetchTimeline(updated.id);
      await fetchIncidents();
    } catch (err: any) {
      setError(err?.message || `Failed to transition incident to ${targetStatus}`);
    } finally {
      setIsSubmittingTransition(false);
    }
  };

  // KPIs
  const kpiStats = useMemo(() => {
    const total = incidents.length;
    const open = incidents.filter((i) => i.status === 'OPEN').length;
    const investigating = incidents.filter((i) => i.status === 'INVESTIGATING' || i.status === 'ACKNOWLEDGED').length;
    const resolved = incidents.filter((i) => i.status === 'RESOLVED' || i.status === 'CLOSED').length;
    const critical = incidents.filter((i) => i.severity === 'CRITICAL' && i.status !== 'RESOLVED' && i.status !== 'CLOSED').length;
    return { total, open, investigating, resolved, critical };
  }, [incidents]);

  // Filtered List
  const filteredIncidents = useMemo(() => {
    return incidents.filter((item) => {
      if (severityFilter !== 'ALL' && item.severity !== severityFilter) return false;
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesService = item.primaryAffectedService.toLowerCase().includes(q);
        const matchesFingerprint = item.fingerprint.toLowerCase().includes(q);
        const matchesId = item.id.toLowerCase().includes(q);
        if (!matchesTitle && !matchesService && !matchesFingerprint && !matchesId) return false;
      }
      return true;
    });
  }, [incidents, severityFilter, statusFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans">
      {/* Top Header */}
      <div className="border-b border-zinc-800 bg-[#111113]/90 px-6 py-4 backdrop-blur-md sticky top-0 z-20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">
              Automated Incident Detection & Triage
            </h1>
            <span className="px-2 py-0.5 text-xs font-mono font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              M7 Engine Active
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1 font-mono">
            Deterministic PromQL multi-window burn-rate SLO violation detection, alert deduplication & topology correlation
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            data-testid="evaluate-incidents-btn"
            onClick={handleRunEvaluation}
            disabled={isEvaluating}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-indigo-950/40"
          >
            <Play className={`w-3.5 h-3.5 ${isEvaluating ? 'animate-spin' : ''}`} />
            {isEvaluating ? 'Evaluating Telemetry...' : 'Run Detection Evaluation'}
          </button>
          <button
            onClick={fetchIncidents}
            disabled={isLoading}
            className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Refresh Incidents"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Banner Alert if any */}
        {evaluationResult && (
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>{evaluationResult}</span>
            </div>
            <button
              onClick={() => setEvaluationResult(null)}
              className="text-zinc-400 hover:text-zinc-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-zinc-400 hover:text-zinc-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Live KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="p-4 rounded-xl border border-zinc-800/80 bg-[#111113] relative overflow-hidden">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
              <span>Total Catalog</span>
              <Layers className="w-4 h-4 text-zinc-500" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-zinc-100">{kpiStats.total}</div>
            <div className="mt-1 text-[11px] text-zinc-500">Tracked incidents</div>
          </div>

          <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/[0.03] relative overflow-hidden">
            <div className="flex items-center justify-between text-rose-400 text-xs font-medium">
              <span>Critical Active</span>
              <Flame className="w-4 h-4 text-rose-500" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-rose-400">{kpiStats.critical}</div>
            <div className="mt-1 text-[11px] text-rose-500/70">Unresolved P0/P1</div>
          </div>

          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.03] relative overflow-hidden">
            <div className="flex items-center justify-between text-amber-400 text-xs font-medium">
              <span>Active / Open</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-amber-400">{kpiStats.open}</div>
            <div className="mt-1 text-[11px] text-amber-500/70">Awaiting response</div>
          </div>

          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/[0.03] relative overflow-hidden">
            <div className="flex items-center justify-between text-blue-400 text-xs font-medium">
              <span>Investigating</span>
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-blue-400">{kpiStats.investigating}</div>
            <div className="mt-1 text-[11px] text-blue-500/70">Triage in progress</div>
          </div>

          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] relative overflow-hidden">
            <div className="flex items-center justify-between text-emerald-400 text-xs font-medium">
              <span>Resolved</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">{kpiStats.resolved}</div>
            <div className="mt-1 text-[11px] text-emerald-500/70">Stabilized & closed</div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-xl border border-zinc-800 bg-[#111113]">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by service, fingerprint, title..."
                className="w-full bg-[#18181b] border border-zinc-700/60 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Severity Filter */}
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <Filter className="w-3.5 h-3.5 text-zinc-500" />
              <span>Severity:</span>
              <select
                aria-label="Filter by Severity"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-[#18181b] border border-zinc-700/60 rounded-lg px-2.5 py-1 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="WARNING">Warning</option>
                <option value="INFO">Info</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <span>Status:</span>
              <select
                aria-label="Filter by Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#18181b] border border-zinc-700/60 rounded-lg px-2.5 py-1 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono"
              >
                <option value="ALL">All Statuses</option>
                <option value="OPEN">Open</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="INVESTIGATING">Investigating</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Incidents Table */}
        <div className="rounded-xl border border-zinc-800 bg-[#111113] overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-zinc-500 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
              <span className="text-xs font-mono">Loading incident telemetry records...</span>
            </div>
          ) : filteredIncidents.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 flex flex-col items-center justify-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500/60" />
              <span className="text-sm font-medium text-zinc-300">No Incidents Detected</span>
              <p className="text-xs text-zinc-500 max-w-sm">
                No active incidents match the current filters. All sandbox microservices and SLO error budgets are operating within normal baseline bounds.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50 text-zinc-400 font-mono text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">Severity</th>
                    <th className="py-3 px-4">Incident & Fingerprint</th>
                    <th className="py-3 px-4">Primary Service</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Breaches</th>
                    <th className="py-3 px-4">Last Detected</th>
                    <th className="py-3 px-4">Correlation</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono">
                  {filteredIncidents.map((incident) => {
                    const isSelected = selectedIncident?.id === incident.id;
                    return (
                      <tr
                        key={incident.id}
                        onClick={() => handleSelectIncident(incident)}
                        className={`hover:bg-zinc-800/40 cursor-pointer transition-colors ${
                          isSelected ? 'bg-indigo-950/20 border-l-2 border-indigo-500' : ''
                        }`}
                      >
                        {/* Severity Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <SeverityBadge severity={incident.severity} />
                        </td>

                        {/* Title & Fingerprint */}
                        <td className="py-3.5 px-4">
                          <div className="font-sans font-medium text-zinc-200 text-xs">
                            {incident.title}
                          </div>
                          <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-1.5 mt-0.5">
                            <span className="text-zinc-400">FP: {incident.fingerprint}</span>
                            <span>•</span>
                            <span>ID: {incident.id.slice(0, 16)}</span>
                          </div>
                        </td>

                        {/* Primary Service */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60 font-mono text-[11px]">
                            {incident.primaryAffectedService}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <StatusBadge status={incident.status} />
                        </td>

                        {/* Occurrences */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-zinc-400">
                          <span className="font-semibold text-zinc-200">{incident.occurrenceCount}</span>
                          <span className="text-zinc-500 text-[10px] ml-1">cycles</span>
                        </td>

                        {/* Last Detected */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-zinc-400 text-[11px]">
                          {formatRelativeTime(incident.lastDetectedAt)}
                        </td>

                        {/* Linked Chaos Experiment */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {incident.relatedExperimentId ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px]">
                              <Zap className="w-2.5 h-2.5" />
                              {incident.relatedExperimentId}
                            </span>
                          ) : (
                            <span className="text-zinc-600 text-[11px]">—</span>
                          )}
                        </td>

                        {/* Details Action */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectIncident(incident);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-sans transition-colors"
                          >
                            <span>Inspect</span>
                            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Incident Detail Drawer / Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-[#111113] border-l border-zinc-800 h-full flex flex-col shadow-2xl overflow-hidden">
            {/* Drawer Header */}
            <div className="p-5 border-b border-zinc-800 bg-[#141416] flex items-start justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={selectedIncident.severity} />
                  <StatusBadge status={selectedIncident.status} />
                  <span className="text-xs font-mono text-zinc-400">
                    FP: {selectedIncident.fingerprint}
                  </span>
                </div>
                <h2 className="text-base font-bold text-zinc-100 font-sans">
                  {selectedIncident.title}
                </h2>
                <div className="text-xs text-zinc-400 font-mono flex items-center gap-3">
                  <span>Service: <strong className="text-zinc-200">{selectedIncident.primaryAffectedService}</strong></span>
                  <span>•</span>
                  <span>First: {new Date(selectedIncident.firstDetectedAt).toLocaleTimeString()}</span>
                  <span>•</span>
                  <span>Last: {new Date(selectedIncident.lastDetectedAt).toLocaleTimeString()}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lifecycle Control Bar (RBAC Guarded) */}
            <div className="px-5 py-3 border-b border-zinc-800 bg-zinc-900/40 flex items-center justify-between gap-3">
              <div className="text-xs font-mono text-zinc-400 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span>Lifecycle State Machine:</span>
              </div>

              {canManage ? (
                <div className="flex items-center gap-2">
                  {selectedIncident.status === 'OPEN' && (
                    <button
                      onClick={() => handleExecuteTransition('ACKNOWLEDGED')}
                      disabled={isSubmittingTransition}
                      className="px-2.5 py-1 text-xs font-medium rounded bg-amber-600/80 hover:bg-amber-600 text-white transition-colors"
                    >
                      Acknowledge
                    </button>
                  )}

                  {(selectedIncident.status === 'OPEN' || selectedIncident.status === 'ACKNOWLEDGED') && (
                    <button
                      onClick={() => handleExecuteTransition('INVESTIGATING')}
                      disabled={isSubmittingTransition}
                      className="px-2.5 py-1 text-xs font-medium rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                    >
                      Investigate
                    </button>
                  )}

                  {(selectedIncident.status === 'OPEN' ||
                    selectedIncident.status === 'ACKNOWLEDGED' ||
                    selectedIncident.status === 'INVESTIGATING') && (
                    <button
                      onClick={() => handleExecuteTransition('RESOLVED')}
                      disabled={isSubmittingTransition}
                      className="px-2.5 py-1 text-xs font-medium rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                    >
                      Resolve
                    </button>
                  )}

                  {selectedIncident.status === 'RESOLVED' && (
                    <button
                      onClick={() => handleExecuteTransition('CLOSED')}
                      disabled={isSubmittingTransition}
                      className="px-2.5 py-1 text-xs font-medium rounded bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
                    >
                      Close Incident
                    </button>
                  )}

                  {selectedIncident.status === 'CLOSED' && (
                    <button
                      onClick={() => handleExecuteTransition('INVESTIGATING')}
                      disabled={isSubmittingTransition}
                      className="px-2.5 py-1 text-xs font-medium rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
                    >
                      Reopen Incident
                    </button>
                  )}

                  <button
                    onClick={() => navigate(`/reports?incidentId=${selectedIncident.id}`)}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-sm ml-auto"
                    title="Open AI Postmortem Workspace"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                    <span>AI Postmortem</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="text-[11px] font-mono text-zinc-500 bg-zinc-800/60 px-2.5 py-1 rounded">
                    Operator actions disabled (Viewer Role)
                  </div>
                  <button
                    onClick={() => navigate(`/reports?incidentId=${selectedIncident.id}`)}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                    <span>View AI Postmortem</span>
                  </button>
                </div>
              )}
            </div>

            {/* Drawer Tabs */}
            <div className="flex border-b border-zinc-800 bg-[#111113] px-5 text-xs font-mono">
              <button
                onClick={() => setActiveDrawerTab('overview')}
                className={`py-3 px-3 border-b-2 font-medium transition-colors ${
                  activeDrawerTab === 'overview'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Overview & Timeline
              </button>
              <button
                onClick={() => setActiveDrawerTab('topology')}
                className={`py-3 px-3 border-b-2 font-medium transition-colors ${
                  activeDrawerTab === 'topology'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Topology & Symptoms
              </button>
              <button
                onClick={() => setActiveDrawerTab('evidence')}
                className={`py-3 px-3 border-b-2 font-medium transition-colors ${
                  activeDrawerTab === 'evidence'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Evidence Package
              </button>
              <button
                onClick={() => setActiveDrawerTab('rca')}
                className={`py-3 px-3 border-b-2 font-medium transition-colors flex items-center gap-1.5 ${
                  activeDrawerTab === 'rca'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Compass className="w-3.5 h-3.5 text-indigo-400" />
                <span>Deterministic RCA</span>
              </button>
              {selectedIncident.relatedExperimentId && (
                <button
                  onClick={() => setActiveDrawerTab('experiment')}
                  className={`py-3 px-3 border-b-2 font-medium transition-colors ${
                    activeDrawerTab === 'experiment'
                      ? 'border-amber-500 text-amber-400'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Chaos Correlation
                </button>
              )}
              <button
                onClick={() => navigate(`/reports?incidentId=${selectedIncident.id}`)}
                className="py-3 px-3 border-b-2 border-transparent font-medium transition-colors text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 ml-auto"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Open Postmortem Workspace &rarr;</span>
              </button>
            </div>

            {/* Drawer Body Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
              {activeDrawerTab === 'overview' && (
                <div className="space-y-6">
                  {/* Incident Description */}
                  <div className="p-3.5 rounded-xl border border-zinc-800 bg-[#18181b] space-y-2">
                    <div className="text-zinc-400 font-mono text-[11px] uppercase tracking-wider">
                      Breach Summary
                    </div>
                    <p className="text-zinc-200 leading-relaxed font-sans text-xs">
                      {selectedIncident.description}
                    </p>
                    <div className="flex items-center gap-2 pt-2 text-[11px] font-mono text-zinc-400 border-t border-zinc-800">
                      <span>Source: <strong className="text-zinc-300">{selectedIncident.detectionSource}</strong></span>
                      <span>•</span>
                      <span>Triggered Rules: <strong className="text-zinc-300">{selectedIncident.triggeredRuleIds.join(', ')}</strong></span>
                    </div>
                  </div>

                  {/* Lifecycle Audit Timeline */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-300 font-semibold font-sans">
                        Immutable Audit Timeline
                      </span>
                      <span className="text-zinc-500 font-mono text-[11px]">
                        {timelineEvents.length} events recorded
                      </span>
                    </div>

                    {isLoadingTimeline ? (
                      <div className="p-4 text-center text-zinc-500 font-mono">
                        Loading timeline events...
                      </div>
                    ) : (
                      <div className="space-y-3 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-800">
                        {timelineEvents.map((evt) => (
                          <div key={evt.id} className="relative">
                            <span className="absolute -left-6 top-1.5 w-2 h-2 rounded-full bg-indigo-500 ring-4 ring-[#111113]" />
                            <div className="p-3 rounded-lg border border-zinc-800/80 bg-[#18181b] space-y-1">
                              <div className="flex items-center justify-between font-mono text-[11px]">
                                <span className="font-semibold text-zinc-200">
                                  {evt.fromStatus ? `${evt.fromStatus} → ${evt.toStatus}` : evt.toStatus}
                                </span>
                                <span className="text-zinc-500">
                                  {new Date(evt.timestamp).toLocaleString()}
                                </span>
                              </div>
                              <div className="text-[11px] text-zinc-400 font-sans">
                                {evt.note || 'No operator notes provided.'}
                              </div>
                              <div className="text-[10px] text-zinc-500 font-mono">
                                Actor: {evt.triggeredBy}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeDrawerTab === 'topology' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-zinc-800 bg-[#18181b] space-y-3">
                    <div className="flex items-center gap-2 text-indigo-400 font-medium">
                      <GitBranch className="w-4 h-4" />
                      <span>Affected Service Dependency Graph (M4 Correlation)</span>
                    </div>
                    <p className="text-zinc-400 text-xs">
                      Deterministic upstream and downstream symptom propagation mapped from the M4 topology graph.
                    </p>

                    <div className="mt-3 space-y-2 font-mono">
                      <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                        <span className="text-zinc-400">Primary Fault Target:</span>
                        <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
                          {selectedIncident.primaryAffectedService}
                        </span>
                      </div>

                      <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800 space-y-1.5">
                        <span className="text-zinc-400">Correlated Upstream Symptom Callers:</span>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {selectedIncident.relatedAffectedServices.length > 0 ? (
                            selectedIncident.relatedAffectedServices.map((svc) => (
                              <span
                                key={svc}
                                className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              >
                                {svc}
                              </span>
                            ))
                          ) : (
                            <span className="text-zinc-500">No secondary upstream symptoms detected</span>
                          )}
                        </div>
                      </div>

                      {selectedIncident.evidencePackage.affectedDependencyPaths.length > 0 && (
                        <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800 space-y-1.5">
                          <span className="text-zinc-400">Propagation Paths:</span>
                          <div className="space-y-1 pt-1">
                            {selectedIncident.evidencePackage.affectedDependencyPaths.map((p, idx) => (
                              <div
                                key={idx}
                                className="text-[11px] text-zinc-300 bg-zinc-950 p-1.5 rounded border border-zinc-800/80"
                              >
                                {p}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeDrawerTab === 'evidence' && (
                <div className="space-y-4">
                  {/* Telemetry Freshness Status */}
                  <div className="p-3.5 rounded-xl border border-zinc-800 bg-[#18181b] flex items-center justify-between">
                    <span className="text-zinc-400 font-mono">Telemetry Freshness:</span>
                    <span
                      className={`px-2 py-0.5 rounded font-mono font-medium text-[11px] ${
                        selectedIncident.evidencePackage.telemetryFreshness === 'FRESH'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : selectedIncident.evidencePackage.telemetryFreshness === 'UNCERTAIN'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {selectedIncident.evidencePackage.telemetryFreshness}
                    </span>
                  </div>

                  {/* Metrics Snapshot */}
                  <div className="p-4 rounded-xl border border-zinc-800 bg-[#18181b] space-y-3">
                    <div className="text-zinc-300 font-semibold font-sans">
                      PromQL Telemetry Snapshot at Breach Time
                    </div>
                    <div className="grid grid-cols-2 gap-2 font-mono">
                      {Object.entries(selectedIncident.evidencePackage.metricSnapshots).map(([k, v]) => (
                        <div key={k} className="p-2.5 rounded bg-zinc-900 border border-zinc-800">
                          <div className="text-zinc-500 text-[10px]">{k}</div>
                          <div className="text-zinc-200 font-bold text-sm mt-0.5">
                            {typeof v === 'number' ? v.toFixed(2) : String(v)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Correlated Traces & Logs */}
                  <div className="p-4 rounded-xl border border-zinc-800 bg-[#18181b] space-y-3">
                    <div className="text-zinc-300 font-semibold font-sans">
                      Correlated Distributed Traces & Logs
                    </div>
                    <div className="space-y-2 font-mono">
                      <div>
                        <span className="text-zinc-500 text-[10px]">JAEGER TRACE IDS:</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {selectedIncident.evidencePackage.traceIds.map((tr) => (
                            <span
                              key={tr}
                              className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[11px]"
                            >
                              {tr}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2">
                        <span className="text-zinc-500 text-[10px]">LOKI LOG RECORD IDS:</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {selectedIncident.evidencePackage.logIds.map((lg) => (
                            <span
                              key={lg}
                              className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60 text-[11px]"
                            >
                              {lg}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeDrawerTab === 'experiment' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3">
                    <div className="flex items-center gap-2 text-amber-400 font-semibold">
                      <Zap className="w-4 h-4" />
                      <span>Contextual Chaos Experiment Correlation (M5 Engine)</span>
                    </div>
                    <p className="text-zinc-300 text-xs font-sans">
                      This incident occurred concurrently with active fault injection on the target microservice.
                    </p>

                    <div className="mt-3 space-y-2 font-mono text-xs">
                      <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                        <span className="text-zinc-400">Experiment ID:</span>
                        <span className="text-amber-400 font-bold">{selectedIncident.relatedExperimentId}</span>
                      </div>
                      <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                        <span className="text-zinc-400">Injected Fault:</span>
                        <span className="text-zinc-200">{selectedIncident.evidencePackage.experimentFaultType || 'UNKNOWN'}</span>
                      </div>
                      <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                        <span className="text-zinc-400">Fault Magnitude:</span>
                        <span className="text-zinc-200">{selectedIncident.evidencePackage.experimentMagnitude ?? '—'}</span>
                      </div>
                      <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                        <span className="text-zinc-400">Timing Relative to Fault:</span>
                        <span className="text-indigo-400 uppercase font-semibold">
                          {selectedIncident.evidencePackage.startedRelativeToExperiment || 'DURING'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeDrawerTab === 'rca' && (
                <div className="space-y-4">
                  <RCAInvestigationWorkspace
                    incidentId={selectedIncident.id}
                    incidentTitle={selectedIncident.title}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// UI Badge Helpers
function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  switch (severity) {
    case 'CRITICAL':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px] font-mono font-medium">
          <Flame className="w-3 h-3" />
          CRITICAL
        </span>
      );
    case 'WARNING':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-mono font-medium">
          <AlertTriangle className="w-3 h-3" />
          WARNING
        </span>
      );
    case 'INFO':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-mono font-medium">
          <Info className="w-3 h-3" />
          INFO
        </span>
      );
  }
}

function StatusBadge({ status }: { status: IncidentStatus }) {
  switch (status) {
    case 'OPEN':
      return (
        <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px] font-mono">
          OPEN
        </span>
      );
    case 'ACKNOWLEDGED':
      return (
        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-mono">
          ACKNOWLEDGED
        </span>
      );
    case 'INVESTIGATING':
      return (
        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-mono">
          INVESTIGATING
        </span>
      );
    case 'RESOLVED':
      return (
        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-mono">
          RESOLVED
        </span>
      );
    case 'CLOSED':
      return (
        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60 text-[11px] font-mono">
          CLOSED
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[11px] font-mono">
          {status}
        </span>
      );
  }
}

function formatRelativeTime(dateString: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return dateString;
  }
}
