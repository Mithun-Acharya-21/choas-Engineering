import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Layers,
  RotateCcw,
  Shield,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  DistributedTrace,
  ExperimentTelemetryCorrelation,
  LogEntry,
  TelemetryWindowSummary,
} from '../../types/domain/telemetry';

interface ExperimentComparisonViewProps {
  correlation: ExperimentTelemetryCorrelation;
  onClose?: () => void;
}

export const ExperimentComparisonView: React.FC<ExperimentComparisonViewProps> = ({
  correlation,
  onClose,
}) => {
  const [selectedPhase, setSelectedPhase] = useState<'all' | 'baseline' | 'fault_active' | 'recovery'>('all');
  const [selectedTrace, setSelectedTrace] = useState<DistributedTrace | null>(
    correlation.correlatedTraces[0] || null
  );

  const renderPhaseCard = (summary: TelemetryWindowSummary, label: string, accentColor: string, badge: string) => {
    return (
      <div className={`p-4 rounded-lg bg-[#18181b] border border-[#27272a] flex flex-col justify-between space-y-3`}>
        <div className="flex items-center justify-between pb-2 border-b border-[#27272a]">
          <div>
            <span className="text-[10px] font-mono tracking-wider uppercase text-zinc-400">{label}</span>
            <div className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              <span>{summary.phase.replace('_', ' ').toUpperCase()}</span>
            </div>
          </div>
          <span className={`px-2 py-0.5 text-[9px] font-mono rounded border ${badge}`}>
            {summary.sampleCount} SAMPLES
          </span>
        </div>

        {/* Core Latency Metrics */}
        <div className="grid grid-cols-3 gap-2 text-center py-1 bg-[#111113] rounded border border-[#27272a]">
          <div>
            <div className="text-[9px] text-zinc-500 font-mono">P50</div>
            <div className="text-xs font-mono font-medium text-zinc-200">{summary.avgP50Ms}ms</div>
          </div>
          <div>
            <div className="text-[9px] text-zinc-500 font-mono">P95</div>
            <div className="text-xs font-mono font-medium text-zinc-200">{summary.avgP95Ms}ms</div>
          </div>
          <div>
            <div className="text-[9px] text-zinc-500 font-mono">P99</div>
            <div className={`text-xs font-mono font-bold ${accentColor}`}>{summary.avgP99Ms}ms</div>
          </div>
        </div>

        {/* Throughput & Health */}
        <div className="space-y-1.5 text-[11px] font-mono">
          <div className="flex justify-between text-zinc-400">
            <span>Throughput:</span>
            <span className="text-zinc-200">{summary.avgRps} rps</span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>Error Rate:</span>
            <span className={summary.avgErrorRatePct > 1 ? 'text-red-400 font-bold' : 'text-emerald-400'}>
              {summary.avgErrorRatePct}%
            </span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>CPU / Memory:</span>
            <span className="text-zinc-300">{summary.cpuUtilizationPct}% / {summary.memoryUtilizationPct}%</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 text-zinc-100 bg-[#09090b] p-6 rounded-lg border border-[#27272a]" data-testid="experiment-comparison-view">
      {/* Header & Impact Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#27272a]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" />
              Experiment Telemetry Correlation
            </h2>
            <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">
              {correlation.experimentId}
            </span>
            <span className="flex items-center gap-1 rounded border border-[#10b981]/30 bg-[#10b981]/10 px-1.5 py-0.5 font-mono text-[9px] text-[#10b981]">
              <Shield className="h-2.5 w-2.5" />
              3-PHASE CORRELATED
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Continuous time-correlated telemetry window: Target <span className="text-indigo-300 font-mono font-medium">{correlation.targetService}</span> with fault <span className="text-amber-300 font-mono font-medium">{correlation.faultType} ({correlation.faultMagnitude}{correlation.faultUnit})</span>.
          </p>
        </div>

        {/* Delta Callout */}
        <div className="flex items-center gap-4">
          <div className="px-3 py-1.5 rounded bg-[#18181b] border border-[#27272a] text-right">
            <span className="text-[10px] font-mono text-zinc-500 block uppercase">P99 Impact Delta</span>
            <span className="text-sm font-bold font-mono text-amber-400 flex items-center gap-1 justify-end">
              <TrendingUp className="w-3.5 h-3.5" />
              +{correlation.impactDeltaP99Pct}%
            </span>
          </div>

          <div className="px-3 py-1.5 rounded bg-[#18181b] border border-[#27272a] text-right">
            <span className="text-[10px] font-mono text-zinc-500 block uppercase">Resilience Status</span>
            <span className="text-sm font-bold font-mono text-emerald-400 flex items-center gap-1 justify-end">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {correlation.recovered ? 'RECOVERED' : 'UNSTABLE'}
            </span>
          </div>
        </div>
      </div>

      {/* 3 Continuous Windows Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {renderPhaseCard(
          correlation.baseline,
          'Phase 1 — Steady State',
          'text-emerald-400',
          'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        )}
        {renderPhaseCard(
          correlation.faultActive,
          'Phase 2 — Active Fault Injection',
          'text-red-400',
          'bg-red-500/10 text-red-400 border-red-500/20'
        )}
        {renderPhaseCard(
          correlation.recovery,
          'Phase 3 — Post-Fault Recovery',
          'text-cyan-400',
          'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
        )}
      </div>

      {/* Correlated Traces & Span Breakdown */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            Correlated Distributed Traces (W3C Trace Context)
          </h3>
          <span className="text-xs font-mono text-zinc-400">
            {correlation.correlatedTraces.length} Traces Captured During Fault Window
          </span>
        </div>

        {/* Trace List & Waterfall View */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Traces List */}
          <div className="space-y-2 lg:col-span-1">
            {correlation.correlatedTraces.map((trace) => {
              const isSelected = selectedTrace?.traceId === trace.traceId;
              return (
                <div
                  key={trace.traceId}
                  onClick={() => setSelectedTrace(trace)}
                  className={`p-3 rounded border cursor-pointer transition text-xs font-mono ${
                    isSelected
                      ? 'bg-indigo-950/30 border-indigo-500/50 text-white'
                      : 'bg-[#18181b] border-[#27272a] text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-zinc-200 truncate">{trace.rootOperation}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        trace.hasErrors ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {trace.durationMs}ms
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500">
                    <span className="truncate">trace-{trace.traceId.slice(0, 8)}...</span>
                    <span>{trace.spansCount} spans</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Trace Waterfall Breakdown */}
          <div className="lg:col-span-2 p-4 rounded-lg bg-[#111113] border border-[#27272a] space-y-3">
            {selectedTrace ? (
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#27272a] text-xs font-mono">
                  <div className="text-zinc-300">
                    <span className="text-zinc-500">Root:</span> {selectedTrace.rootService} → {selectedTrace.rootOperation}
                  </div>
                  <div className="text-zinc-400">
                    Total Duration: <span className="text-amber-400 font-bold">{selectedTrace.durationMs}ms</span>
                  </div>
                </div>

                <div className="space-y-2 mt-3">
                  {selectedTrace.spans.map((span) => {
                    const maxDuration = selectedTrace.durationMs || 100;
                    const leftPct = Math.min(90, (span.startOffsetMs / maxDuration) * 100);
                    const widthPct = Math.max(5, Math.min(100 - leftPct, (span.durationMs / maxDuration) * 100));

                    const isTargetSpan = span.service === correlation.targetService;
                    const isError = span.status === 'error';

                    return (
                      <div key={span.id} className="text-xs font-mono space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1.5 font-medium text-zinc-200">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isError ? 'bg-red-500' : isTargetSpan ? 'bg-amber-400' : 'bg-emerald-400'
                              }`}
                            />
                            {span.service}: {span.operation}
                          </span>
                          <span className={`font-bold ${isError ? 'text-red-400' : 'text-zinc-400'}`}>
                            {span.durationMs}ms {span.statusCode ? `(${span.statusCode})` : ''}
                          </span>
                        </div>

                        {/* Bar Representation */}
                        <div className="w-full h-3 bg-zinc-900 rounded overflow-hidden relative">
                          <div
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                            className={`absolute top-0 bottom-0 rounded ${
                              isError
                                ? 'bg-red-500/80 border border-red-400'
                                : isTargetSpan
                                ? 'bg-amber-500/80 border border-amber-400'
                                : 'bg-indigo-500/70 border border-indigo-400'
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-xs font-mono text-zinc-500 py-8 text-center">
                Select a trace to inspect waterfall duration breakdown.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Correlated Logs */}
      {correlation.correlatedLogs.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Correlated Fault & Outlier Logs
          </h3>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {correlation.correlatedLogs.map((log) => (
              <div
                key={log.id}
                className="p-2 rounded bg-[#18181b] border border-[#27272a] text-xs font-mono flex items-start gap-3"
              >
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                    log.level === 'CRITICAL' || log.level === 'ERROR'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {log.level}
                </span>
                <span className="text-zinc-400 shrink-0">{log.service}:</span>
                <span className="text-zinc-200 truncate flex-1">{log.message}</span>
                {log.durationMs && (
                  <span className="text-zinc-500 shrink-0">{log.durationMs}ms</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
