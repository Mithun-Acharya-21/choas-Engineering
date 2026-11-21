import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Compass,
  Cpu,
  Database,
  ExternalLink,
  Flame,
  GitBranch,
  Info,
  Layers,
  Network,
  Play,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { canManageIncidents } from '../../context/rbac';
import { rcaService } from '../../services/api/rcaService';
import { mockRcaService } from '../../services/mock/mockRcaService';
import {
  ConfidenceClassification,
  RCAAnalysis,
  RCACandidate,
  RCAFactor,
} from '../../types/domain/rca';

interface RCAInvestigationWorkspaceProps {
  incidentId: string;
  incidentTitle: string;
  onClose?: () => void;
}

export const RCAInvestigationWorkspace: React.FC<RCAInvestigationWorkspaceProps> = ({
  incidentId,
  incidentTitle,
  onClose,
}) => {
  const { role, isMockMode } = useAuth();
  const service = isMockMode ? mockRcaService : rcaService;

  const [analysis, setAnalysis] = useState<RCAAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<RCACandidate | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'factors' | 'evidence' | 'propagation'>('overview');

  const canManage = canManageIncidents(role);

  // Load existing or latest RCA
  const fetchRCA = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await service.getLatestRCA(incidentId);
      setAnalysis(res);
      if (res?.primary_root_cause) {
        setSelectedCandidate(res.primary_root_cause);
      } else if (res?.candidates && res.candidates.length > 0) {
        setSelectedCandidate(res.candidates[0]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load RCA analysis');
    } finally {
      setIsLoading(false);
    }
  }, [incidentId, service]);

  useEffect(() => {
    fetchRCA();
  }, [fetchRCA]);

  // Trigger Deterministic RCA Analysis
  const handleTriggerAnalysis = async () => {
    if (!canManage) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const res = await service.startRCAAnalysis(incidentId, 'v1.0.0-deterministic', true);
      setAnalysis(res);
      if (res.primary_root_cause) {
        setSelectedCandidate(res.primary_root_cause);
      }
    } catch (err: any) {
      setError(err?.message || 'RCA analysis execution failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="bg-[#111113] border border-zinc-800 rounded-xl flex flex-col overflow-hidden text-xs text-zinc-100 font-sans shadow-2xl">
      {/* Header Bar */}
      <div className="p-4 border-b border-zinc-800 bg-[#141416] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Compass className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-bold tracking-tight text-zinc-100">
              Deterministic Root Cause Analysis (M8)
            </h2>
            {analysis && (
              <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                {analysis.execution_metadata.algorithm_version}
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">
            Incident: <strong className="text-zinc-200">{incidentTitle}</strong>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {canManage ? (
            <button
              onClick={handleTriggerAnalysis}
              disabled={isAnalyzing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 shadow-sm"
            >
              <Play className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              {isAnalyzing ? 'Computing RCA...' : analysis ? 'Re-run Analysis' : 'Run Deterministic RCA'}
            </button>
          ) : (
            <span className="px-2.5 py-1 text-[11px] font-mono rounded bg-zinc-800 text-zinc-500">
              Viewer Read-Only Mode
            </span>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Body */}
      {isLoading ? (
        <div className="p-12 text-center text-zinc-500 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
          <span className="font-mono text-xs">Analyzing telemetry waterfalls, graph dependencies & chaos records...</span>
        </div>
      ) : !analysis ? (
        <div className="p-12 text-center text-zinc-500 flex flex-col items-center justify-center gap-3">
          <Compass className="w-8 h-8 text-indigo-400/50" />
          <span className="text-sm font-medium text-zinc-300">No RCA Analysis Available Yet</span>
          <p className="text-xs text-zinc-500 max-w-md">
            Click "Run Deterministic RCA" to evaluate distributed traces, PromQL metrics, and topology propagation paths.
          </p>
          {canManage && (
            <button
              onClick={handleTriggerAnalysis}
              className="mt-2 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              Run Deterministic RCA
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-zinc-800 overflow-hidden">
          {/* Left Column: Ranked Candidate List */}
          <div className="w-full md:w-80 shrink-0 p-4 space-y-4 bg-[#111113]/50 overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                Ranked Candidates ({analysis.candidates.length})
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                {analysis.execution_metadata.execution_duration_ms}ms
              </span>
            </div>

            <div className="space-y-2">
              {analysis.candidates.map((cand, idx) => {
                const isSelected = selectedCandidate?.candidate_id === cand.candidate_id;
                return (
                  <div
                    key={cand.candidate_id}
                    onClick={() => setSelectedCandidate(cand)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-950/20 shadow-md'
                        : 'border-zinc-800/80 bg-[#18181b] hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-zinc-500 font-bold text-xs">#{idx + 1}</span>
                        <span className="font-semibold text-zinc-200 font-sans text-xs">
                          {cand.service_name}
                        </span>
                      </div>
                      <ConfidenceBadge confidence={cand.confidence} />
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {cand.is_primary_cause ? (
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono text-[9px] font-bold">
                            PRIMARY CAUSE
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono text-[9px]">
                            COLLATERAL SYMPTOM
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-sm text-zinc-100">
                        {cand.score.toFixed(1)}
                        <span className="text-[10px] text-zinc-500 font-normal">/100</span>
                      </span>
                    </div>

                    {/* Score Bar */}
                    <div className="mt-2 w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden border border-zinc-800">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          cand.is_primary_cause ? 'bg-indigo-500' : 'bg-zinc-600'
                        }`}
                        style={{ width: `${Math.min(100, cand.score)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Missing Evidence Warnings */}
            {analysis.missing_evidence_warnings.length > 0 && (
              <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-amber-400 font-medium text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Telemetry Completeness Notices</span>
                </div>
                {analysis.missing_evidence_warnings.map((w, idx) => (
                  <p key={idx} className="text-[10px] text-zinc-400 leading-relaxed font-mono">
                    • {w}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Selected Candidate Deep Dive */}
          <div className="flex-1 p-5 space-y-5 overflow-y-auto bg-[#09090b]/40">
            {selectedCandidate ? (
              <>
                {/* Candidate Summary Header */}
                <div className="p-4 rounded-xl border border-zinc-800 bg-[#141416] space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-zinc-100">
                          {selectedCandidate.service_name}
                        </span>
                        <span className="font-mono text-[11px] text-zinc-400 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                          {selectedCandidate.service_id}
                        </span>
                        {selectedCandidate.is_primary_cause && (
                          <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono text-[10px] font-bold">
                            ROOT CAUSE IDENTIFIED
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1 font-mono">
                        Deterministic Causal Attribution Score: <strong className="text-indigo-400 text-sm font-bold">{selectedCandidate.score.toFixed(1)}/100</strong>
                      </p>
                    </div>

                    <ConfidenceBadge confidence={selectedCandidate.confidence} />
                  </div>

                  {/* Recommended Next Actions */}
                  {selectedCandidate.recommended_actions.length > 0 && (
                    <div className="pt-2 border-t border-zinc-800 space-y-1.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                        Recommended Next Investigation Steps
                      </span>
                      <div className="space-y-1">
                        {selectedCandidate.recommended_actions.map((act, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-zinc-300 text-xs">
                            <ArrowRight className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span>{act}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Navigation Tabs */}
                <div className="flex border-b border-zinc-800 text-xs font-mono">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`py-2 px-3 border-b-2 font-medium transition-colors ${
                      activeTab === 'overview'
                        ? 'border-indigo-500 text-indigo-400'
                        : 'border-transparent text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Evidence Rationale
                  </button>
                  <button
                    onClick={() => setActiveTab('factors')}
                    className={`py-2 px-3 border-b-2 font-medium transition-colors ${
                      activeTab === 'factors'
                        ? 'border-indigo-500 text-indigo-400'
                        : 'border-transparent text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Score Factor Breakdown
                  </button>
                  <button
                    onClick={() => setActiveTab('propagation')}
                    className={`py-2 px-3 border-b-2 font-medium transition-colors ${
                      activeTab === 'propagation'
                        ? 'border-indigo-500 text-indigo-400'
                        : 'border-transparent text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Failure Propagation DAG
                  </button>
                </div>

                {/* Tab: Evidence Rationale */}
                {activeTab === 'overview' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Supporting Evidence */}
                    <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] space-y-2.5">
                      <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Supporting Observations ({selectedCandidate.supporting_evidence.length})</span>
                      </div>
                      <div className="space-y-2 pt-1 font-mono text-[11px]">
                        {selectedCandidate.supporting_evidence.map((ev, idx) => (
                          <div key={idx} className="p-2 rounded bg-zinc-900/60 border border-zinc-800 text-zinc-300">
                            • {ev}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Contradicting Evidence */}
                    <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.03] space-y-2.5">
                      <div className="flex items-center gap-2 text-amber-400 font-semibold">
                        <AlertCircle className="w-4 h-4" />
                        <span>Contradicting / Mitigating Observations ({selectedCandidate.contradicting_evidence.length})</span>
                      </div>
                      <div className="space-y-2 pt-1 font-mono text-[11px]">
                        {selectedCandidate.contradicting_evidence.length > 0 ? (
                          selectedCandidate.contradicting_evidence.map((ev, idx) => (
                            <div key={idx} className="p-2 rounded bg-zinc-900/60 border border-zinc-800 text-zinc-300">
                              • {ev}
                            </div>
                          ))
                        ) : (
                          <div className="text-zinc-500 p-2">No contradicting evidence identified.</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab: Factor Breakdown */}
                {activeTab === 'factors' && (
                  <div className="p-4 rounded-xl border border-zinc-800 bg-[#18181b] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-200">
                        Transparent Scoring Model Formulation
                      </span>
                      <span className="font-mono text-[11px] text-zinc-400">
                        Score = ∑ (Weight × Normalized Factor)
                      </span>
                    </div>

                    <div className="divide-y divide-zinc-800/80 font-mono text-xs">
                      {selectedCandidate.factors.map((f) => (
                        <div key={f.factor_type} className="py-2.5 flex items-center justify-between gap-4">
                          <div className="space-y-0.5">
                            <span className="font-medium text-zinc-200 text-xs">
                              {formatFactorName(f.factor_type)}
                            </span>
                            <p className="text-[10px] text-zinc-500 font-sans">
                              {f.explanation}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="font-bold text-zinc-200">
                              +{f.weighted_score.toFixed(1)} pts
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              Weight {(f.weight * 100).toFixed(0)}% • Norm {(f.normalized_score * 100).toFixed(0)}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab: Failure Propagation DAG */}
                {activeTab === 'propagation' && (
                  <div className="p-4 rounded-xl border border-zinc-800 bg-[#18181b] space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-200 flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-indigo-400" />
                        <span>Failure Propagation Paths (M4 Topology Graph)</span>
                      </span>
                      <span className="font-mono text-[11px] text-zinc-500">
                        {analysis.propagation_paths.length} directed paths
                      </span>
                    </div>

                    <div className="space-y-2 font-mono">
                      {analysis.propagation_paths.map((p, idx) => (
                        <div key={idx} className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-400 text-xs">{p.source_service}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-rose-500" />
                            <span className="text-rose-400 font-bold text-xs">{p.target_service}</span>
                          </div>
                          <div className="text-right text-[11px] text-zinc-400">
                            <span>{p.hops} hop(s)</span>
                            {p.propagation_delay_ms > 0 && (
                              <span className="ml-2 text-amber-400">+{p.propagation_delay_ms.toFixed(0)}ms</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 text-center text-zinc-500 font-mono">
                Select a candidate to view its detailed scoring rationale.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function ConfidenceBadge({ confidence }: { confidence: ConfidenceClassification }) {
  switch (confidence) {
    case 'HIGH':
      return (
        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-medium text-[10px]">
          HIGH CONFIDENCE
        </span>
      );
    case 'MEDIUM':
      return (
        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono font-medium text-[10px]">
          MEDIUM CONFIDENCE
        </span>
      );
    case 'LOW':
    default:
      return (
        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 font-mono text-[10px]">
          LOW CONFIDENCE
        </span>
      );
  }
}

function formatFactorName(type: string): string {
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
