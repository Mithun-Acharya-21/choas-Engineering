import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Network,
  RotateCcw,
  Shield,
  X,
} from 'lucide-react';
import { TopologyValidationResult } from '../../../types/domain/topology';

interface ValidationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  validation: TopologyValidationResult | null;
  isValidating?: boolean;
}

export const ValidationDrawer: React.FC<ValidationDrawerProps> = ({
  isOpen,
  onClose,
  validation,
  isValidating = false,
}) => {
  if (!isOpen) return null;

  const isValid = validation?.isValid ?? false;
  const errors = validation?.errors || [];
  const warnings = validation?.warnings || [];
  const cycles = validation?.detectedCycles || [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-[#0e0e11] border-l border-[#27272a] h-full flex flex-col shadow-2xl text-zinc-100 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[#27272a] bg-[#111113] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded flex items-center justify-center border ${
                isValid
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}
            >
              {isValid ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-zinc-100">Topology Validation Engine</h2>
                <span
                  className={`px-2 py-0.5 text-[9px] font-mono rounded border ${
                    isValid
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}
                >
                  {isValid ? 'READY FOR DEPLOYMENT' : 'ACTION REQUIRED'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-mono">
                {validation?.nodeCount || 0} Nodes | {validation?.edgeCount || 0} Directed Edges
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-[#18181b] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {isValidating ? (
            <div className="p-8 text-center text-zinc-400 font-mono flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span>Analyzing graph structure, cycle paths, and container images...</span>
            </div>
          ) : (
            <>
              {/* Fatal Structural Errors */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-zinc-300 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                    Structural Errors ({errors.length})
                  </h3>
                  {errors.length === 0 && (
                    <span className="text-emerald-400 font-mono text-[10px] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> None detected
                    </span>
                  )}
                </div>

                {errors.length > 0 ? (
                  <div className="space-y-2">
                    {errors.map((err, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-red-950/30 border border-red-800/40 text-red-200 space-y-1 font-mono text-[11px]"
                      >
                        <div className="flex items-center justify-between font-semibold text-red-300">
                          <span>{err.code}</span>
                          {err.nodeId && <span className="text-[10px] text-red-400">Node: {err.nodeId}</span>}
                          {err.edgeId && <span className="text-[10px] text-red-400">Edge: {err.edgeId}</span>}
                        </div>
                        <p className="text-[11px] text-red-300/90">{err.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded bg-[#111113] border border-[#27272a] text-zinc-400 text-[11px] font-mono">
                    All nodes comply with RFC 1123, contain approved container images, and maintain valid directed edge connections.
                  </div>
                )}
              </div>

              {/* Architectural Warnings & Cycle Explanations */}
              <div className="space-y-2.5 pt-3 border-t border-[#27272a]">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-zinc-300 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    Architectural Advisories ({warnings.length})
                  </h3>
                </div>

                {warnings.length > 0 ? (
                  <div className="space-y-2">
                    {warnings.map((warn, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/40 text-amber-200 space-y-1 font-mono text-[11px]"
                      >
                        <div className="flex items-center justify-between font-semibold text-amber-300">
                          <span>{warn.code}</span>
                          {warn.cycle && (
                            <span className="text-[10px] text-amber-400 flex items-center gap-1">
                              <RotateCcw className="w-2.5 h-2.5" /> Cycle ({warn.cycle.length} nodes)
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-amber-200/90">{warn.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded bg-[#111113] border border-[#27272a] text-zinc-400 text-[11px] font-mono">
                    No architectural deadlock hazards or exposed secret patterns detected.
                  </div>
                )}
              </div>

              {/* Graph Semantics & Isolation Overview */}
              <div className="space-y-2.5 pt-3 border-t border-[#27272a]">
                <h3 className="font-semibold text-zinc-300 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-indigo-400" />
                  Kubernetes Sandbox Deployment Invariants
                </h3>
                <div className="p-3 rounded-lg bg-[#111113] border border-[#27272a] space-y-2 font-mono text-[11px] text-zinc-400">
                  <div className="flex items-center justify-between">
                    <span>Target Sandbox:</span>
                    <span className="text-zinc-200">READY Sandbox Required</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Toxiproxy Chaos Sidecar:</span>
                    <span className="text-emerald-400">Auto-injected (port 8080)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>NetworkPolicy:</span>
                    <span className="text-emerald-400">Default-Deny Enforced</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Service Discovery:</span>
                    <span className="text-indigo-400">ClusterIP DNS</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#27272a] bg-[#111113] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-[#18181b] hover:bg-zinc-800 rounded border border-[#27272a] transition"
          >
            Close Validation
          </button>
        </div>
      </div>
    </div>
  );
};
