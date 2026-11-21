import React, { useMemo, useState } from 'react';
import { Check, Copy, Search, Trash2, X } from 'lucide-react';
import { LogEntry, LogLevel } from '../types/telemetry';
import { StatusBadge } from './StatusBadge';

interface LogsTracesScreenProps {
  logs: LogEntry[];
  initialFilter: string;
  onClearFilter: () => void;
  onClearLogs: () => void;
}

const KQL_CHIPS = [
  'service:payment-ledger',
  'service:checkout-core',
  'level:CRIT',
  'level:WARN',
];

export const LogsTracesScreen: React.FC<LogsTracesScreenProps> = ({
  logs,
  initialFilter,
  onClearFilter,
  onClearLogs,
}) => {
  const [query, setQuery] = useState(initialFilter);
  const [levelFilter, setLevelFilter] = useState<'ALL' | LogLevel>('ALL');
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(logs[0] ?? null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sync external initialFilter if passed via Topology "Stream Service Logs"
  React.useEffect(() => {
    if (initialFilter) {
      setQuery(initialFilter);
    }
  }, [initialFilter]);

  const filteredLogs = useMemo(() => {
    const terms = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    return logs.filter((entry) => {
      if (levelFilter !== 'ALL' && entry.level !== levelFilter) return false;
      for (const term of terms) {
        if (term.startsWith('service:')) {
          const val = term.slice('service:'.length);
          if (!entry.service.toLowerCase().includes(val)) return false;
        } else if (term.startsWith('level:')) {
          const val = term.slice('level:'.length);
          if (entry.level.toLowerCase() !== val) return false;
        } else if (term.startsWith('trace:')) {
          const val = term.slice('trace:'.length);
          if (!entry.traceId.toLowerCase().includes(val)) return false;
        } else {
          const hay = `${entry.service} ${entry.traceId} ${entry.message} ${JSON.stringify(
            entry.metadata
          )}`.toLowerCase();
          if (!hay.includes(term)) return false;
        }
      }
      return true;
    });
  }, [logs, query, levelFilter]);

  const handleCopy = (e: React.MouseEvent, entry: LogEntry) => {
    e.stopPropagation();
    const text = `${entry.timestampIso} [${entry.level}] ${entry.service} trace=${entry.traceId} ${entry.message}`;
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const totalTraceDuration = useMemo(() => {
    if (!selectedLog || selectedLog.spans.length === 0) return 100;
    return Math.max(
      ...selectedLog.spans.map((sp) => sp.startOffsetMs + sp.durationMs),
      selectedLog.durationMs
    );
  }, [selectedLog]);

  return (
    <div className="flex h-[calc(100vh-48px)] flex-col overflow-hidden">
      {/* KQL Filter Bar & Controls */}
      <div className="shrink-0 space-y-2.5 border-b border-[#27272a] bg-[#09090b] p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[20px] font-semibold tracking-[-0.02em] text-[#fafafa]">
              Incident & Chaos Log Streams
            </h1>
            <span className="rounded border border-[#10b981]/30 bg-[#10b981]/10 px-1.5 py-0.5 font-mono text-[9px] text-[#10b981]">
              SANDBOX ISOLATED
            </span>
            <span className="rounded border border-[#38bdf8]/30 bg-[#38bdf8]/10 px-1.5 py-0.5 font-mono text-[9px] text-[#38bdf8]">
              SAMPLE STREAM
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded border border-[#27272a] bg-[#111113] p-0.5">
              {(['ALL', 'INFO', 'WARN', 'CRIT'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLevelFilter(lvl)}
                  className={`h-6 rounded-[3px] px-2.5 font-mono text-[10px] tracking-[0.04em] transition-colors whitespace-nowrap shrink-0 ${
                    levelFilter === lvl
                      ? 'bg-[#202024] text-[#fafafa]'
                      : 'text-[#71717a] hover:text-[#a1a1aa]'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onClearLogs}
              className="flex h-7 items-center gap-1.5 rounded border border-[#27272a] bg-[#18181b] px-2.5 font-mono text-[11px] text-[#a1a1aa] hover:bg-[#202024] hover:text-[#fafafa]"
            >
              <Trash2 className="h-3 w-3" />
              Clear Buffer
            </button>
          </div>
        </div>

        {/* KQL Search Input */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#71717a]" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!e.target.value) onClearFilter();
              }}
              placeholder="Query KQL: service:payment-ledger level:CRIT trace:tr-89f2c4a10e"
              className="h-8 w-full rounded border border-[#27272a] bg-[#111113] pl-8 pr-8 font-mono text-[12px] text-[#fafafa] placeholder:text-[#71717a] focus:border-[#6366f1] focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  onClearFilter();
                }}
                aria-label="Clear query"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-[#fafafa]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {KQL_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setQuery(chip)}
                className="h-7 rounded border border-[#27272a] bg-[#202024] px-2 font-mono text-[11px] text-[#38bdf8] hover:border-[#38bdf8]/40 transition-colors whitespace-nowrap shrink-0"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Split Pane: Log Stream (Left/Top) + Trace Waterfall (Right/Bottom) */}
      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
        {/* Log Stream Rows */}
        <div className="flex-1 overflow-y-auto bg-[#09090b] font-mono text-[11px]">
          {filteredLogs.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-[#71717a]">
              <span>No log events match your KQL filter.</span>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setLevelFilter('ALL');
                  onClearFilter();
                }}
                className="text-[#38bdf8] hover:underline"
              >
                Reset query filters
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#27272a]/50">
              {filteredLogs.map((entry) => {
                const isSelected = selectedLog?.id === entry.id;
                return (
                  <div
                    key={entry.id}
                    onClick={() => setSelectedLog(entry)}
                    className={`group flex items-center gap-2.5 px-3.5 py-1.5 cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#202024]' : 'hover:bg-[#18181b]'
                    }`}
                  >
                    <span className="hidden sm:inline shrink-0 text-[#71717a] tabular-nums">
                      {entry.timestampIso.slice(11, 23)}
                    </span>
                    <StatusBadge status={entry.level} />
                    <span className="w-32 shrink-0 truncate text-[#fafafa]">
                      {entry.service}
                    </span>
                    <span className="w-24 shrink-0 truncate text-[#38bdf8] tabular-nums">
                      {entry.traceId}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[#a1a1aa]">
                      {entry.message}
                    </span>
                    <span className="hidden md:inline shrink-0 text-[#71717a] tabular-nums">
                      {entry.durationMs}ms
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleCopy(e, entry)}
                      aria-label="Copy log entry"
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[#27272a] bg-[#111113] text-[#a1a1aa] hover:text-[#fafafa] transition-opacity"
                    >
                      {copiedId === entry.id ? (
                        <Check className="h-3 w-3 text-[#10b981]" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Distributed Trace Waterfall Inspector */}
        {selectedLog && (
          <aside className="h-72 lg:h-full w-full lg:w-[420px] shrink-0 overflow-y-auto border-t lg:border-l lg:border-t-0 border-[#27272a] bg-[#111113] p-4">
            <div className="flex items-start justify-between gap-2 border-b border-[#27272a] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedLog.level} />
                  <span className="font-mono text-[12px] font-medium text-[#38bdf8] tabular-nums">
                    {selectedLog.traceId}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-[#71717a] tabular-nums">
                  {selectedLog.timestampIso} · total {selectedLog.durationMs}ms
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                aria-label="Close trace waterfall"
                className="flex h-6 w-6 items-center justify-center rounded text-[#71717a] hover:bg-[#202024] hover:text-[#fafafa]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-3 rounded border border-[#27272a] bg-[#09090b] p-2.5 font-mono text-[11px] text-[#fafafa]">
              {selectedLog.message}
            </div>

            {/* Trace Waterfall Spans */}
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.04em] text-[#71717a]">
                <span>Distributed Span Waterfall</span>
                <span className="tabular-nums">{totalTraceDuration}ms</span>
              </div>

              <div className="space-y-2.5">
                {selectedLog.spans.map((span) => {
                  const leftPct = (span.startOffsetMs / totalTraceDuration) * 100;
                  const widthPct = Math.max(4, (span.durationMs / totalTraceDuration) * 100);
                  const barColor =
                    span.status === 'error'
                      ? 'bg-[#f43f5e]'
                      : span.status === 'degraded'
                      ? 'bg-[#f59e0b]'
                      : 'bg-[#6366f1]';

                  return (
                    <div key={span.id} className="space-y-1">
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span className="truncate text-[#fafafa]">
                          {span.service}{' '}
                          <span className="text-[#71717a]">{span.operation}</span>
                        </span>
                        <span className="shrink-0 pl-2 text-[#a1a1aa] tabular-nums">
                          {span.durationMs}ms
                        </span>
                      </div>
                      <div className="relative h-2.5 w-full overflow-hidden rounded-[2px] bg-[#09090b] border border-[#27272a]">
                        <div
                          className={`absolute top-0 bottom-0 rounded-[1px] ${barColor}`}
                          style={{
                            left: `${Math.min(95, leftPct)}%`,
                            width: `${Math.min(100 - leftPct, widthPct)}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Structured Metadata */}
            <div className="mt-4 border-t border-[#27272a] pt-3">
              <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.04em] text-[#71717a]">
                Event Attributes
              </span>
              <div className="space-y-1.5 rounded border border-[#27272a] bg-[#09090b] p-2.5 font-mono text-[11px]">
                {Object.entries(selectedLog.metadata).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <span className="text-[#71717a]">{k}</span>
                    <span className="text-[#fafafa] tabular-nums">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
