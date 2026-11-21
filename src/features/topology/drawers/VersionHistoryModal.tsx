import React, { useState } from 'react';
import { Clock, History, RotateCcw, X } from 'lucide-react';
import { TopologyVersionRecord } from '../../../types/domain/topology';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  versions: TopologyVersionRecord[];
  currentVersion: number;
  onRevertVersion: (targetVersion: number) => Promise<void>;
  isReadOnly?: boolean;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  isOpen,
  onClose,
  versions,
  currentVersion,
  onRevertVersion,
  isReadOnly = false,
}) => {
  const [revertingVersion, setRevertingVersion] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleRevert = async (v: number) => {
    if (isReadOnly) return;
    setRevertingVersion(v);
    try {
      await onRevertVersion(v);
      onClose();
    } finally {
      setRevertingVersion(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#111113] border border-[#27272a] rounded-lg shadow-2xl p-6 text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#27272a]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Topology Version History</h2>
              <p className="text-xs text-zinc-400 font-mono">Immutable audit snapshots</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-[#18181b] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Versions List */}
        <div className="mt-4 max-h-96 overflow-y-auto divide-y divide-[#27272a]">
          {versions.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-zinc-500">
              No version history records found.
            </div>
          ) : (
            versions.map((ver) => {
              const isCurrent = ver.version === currentVersion;
              const isReverting = revertingVersion === ver.version;

              return (
                <div key={ver.id} className="py-3.5 flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-400">v{ver.version}</span>
                      <span className="text-xs text-zinc-200 font-semibold">{ver.name}</span>
                      {isCurrent && (
                        <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          CURRENT
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(ver.createdAt).toLocaleString()}
                      </span>
                      <span>{ver.nodes?.length || 0} nodes</span>
                      <span>{ver.edges?.length || 0} edges</span>
                    </div>
                  </div>

                  {!isCurrent && !isReadOnly && (
                    <button
                      onClick={() => handleRevert(ver.version)}
                      disabled={isReverting}
                      className="px-2.5 py-1 text-xs font-mono text-zinc-300 hover:text-white bg-[#18181b] hover:bg-zinc-800 rounded border border-[#27272a] transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RotateCcw className={`w-3 h-3 ${isReverting ? 'animate-spin' : ''}`} />
                      <span>Restore</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-[#27272a] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-[#18181b] rounded transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
