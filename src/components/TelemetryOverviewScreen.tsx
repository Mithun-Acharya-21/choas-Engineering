import React, { useMemo, useState } from 'react';
import { Activity, ArrowUpDown, Flame, Search } from 'lucide-react';
import { ExperimentComparisonView } from '../features/observability/ExperimentComparisonView';
import { ExperimentTelemetryCorrelation } from '../types/domain/telemetry';
import {
  ChaosExperiment,
  ClusterId,
  ScreenId,
  ServiceNode,
  ServiceStatus,
  TelemetryPoint,
  TimeRange,
} from '../types/telemetry';
import { Sparkline } from './Sparkline';
import { StatusBadge } from './StatusBadge';
import { TimeSeriesChart } from './TimeSeriesChart';

interface TelemetryOverviewScreenProps {
  cluster: ClusterId;
  timeRange: TimeRange;
  services: ServiceNode[];
  series: TelemetryPoint[];
  experiments: ChaosExperiment[];
  onSelectService: (service: ServiceNode) => void;
  onNavigate: (screen: ScreenId) => void;
}

type SortKey = 'name' | 'rps' | 'p99Ms' | 'errorRatePct' | 'sloBudgetRemainingPct';

export const TelemetryOverviewScreen: React.FC<TelemetryOverviewScreenProps> = ({
  cluster,
  timeRange,
  services,
  series,
  experiments,
  onSelectService,
  onNavigate,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | ServiceStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('p99Ms');
  const [sortAsc, setSortAsc] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [visibleSeries, setVisibleSeries] = useState({
    p99: true,
    p95: true,
    p50: true,
    baseline: true,
  });

  const runningExperiments = experiments.filter((e) => e.status === 'running');
  const latestPoint = series[series.length - 1];
  const prevPoint = series[Math.max(0, series.length - 12)];

  const sampleCorrelation: ExperimentTelemetryCorrelation = useMemo(() => {
    const activeExp = runningExperiments[0] || experiments[0];
    const expId = activeExp?.id || 'exp-9413';
    const target = activeExp?.targetServiceName || 'payment-service';
    const mag = activeExp?.magnitude || 2000;
    const unit = activeExp?.magnitudeUnit || 'ms';

    return {
      experimentId: expId,
      sandboxId: 'sbx-demo-e-comm-01',
      targetService: target,
      faultType: activeExp?.faultType || 'latency',
      faultMagnitude: mag,
      faultUnit: unit,
      startedAt: new Date(Date.now() - 120000).toISOString(),
      completedAt: new Date(Date.now() - 30000).toISOString(),
      baseline: {
        phase: 'baseline',
        startTime: new Date(Date.now() - 180000).toISOString(),
        endTime: new Date(Date.now() - 120000).toISOString(),
        sampleCount: 20,
        avgP50Ms: 28.5,
        avgP95Ms: 52.0,
        avgP99Ms: 64.2,
        avgRps: 98.0,
        avgErrorRatePct: 0.01,
        cpuUtilizationPct: 24.5,
        memoryUtilizationPct: 36.0,
      },
      faultActive: {
        phase: 'fault_active',
        startTime: new Date(Date.now() - 120000).toISOString(),
        endTime: new Date(Date.now() - 60000).toISOString(),
        sampleCount: 20,
        avgP50Ms: 1820.0,
        avgP95Ms: 1980.0,
        avgP99Ms: 2064.2,
        avgRps: 72.0,
        avgErrorRatePct: 14.8,
        cpuUtilizationPct: 68.0,
        memoryUtilizationPct: 58.5,
      },
      recovery: {
        phase: 'recovery',
        startTime: new Date(Date.now() - 60000).toISOString(),
        endTime: new Date().toISOString(),
        sampleCount: 20,
        avgP50Ms: 29.2,
        avgP95Ms: 54.5,
        avgP99Ms: 66.8,
        avgRps: 96.5,
        avgErrorRatePct: 0.04,
        cpuUtilizationPct: 26.0,
        memoryUtilizationPct: 37.5,
      },
      impactDeltaP99Pct: Number((((2064.2 - 64.2) / 64.2) * 100).toFixed(1)),
      recovered: true,
      correlatedTraces: [
        {
          traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
          rootService: 'api-gateway',
          rootOperation: 'POST /api/v1/orders/checkout',
          timestamp: new Date(Date.now() - 75000).toISOString(),
          durationMs: 2115.0,
          spansCount: 4,
          hasErrors: true,
          spans: [
            {
              id: '00f067aa0ba902b7',
              traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
              service: 'api-gateway',
              operation: 'POST /api/v1/orders/checkout',
              startOffsetMs: 0,
              durationMs: 2115.0,
              status: 'error',
              statusCode: 504,
            },
            {
              id: '5fb397be34d23b0f',
              traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
              parentSpanId: '00f067aa0ba902b7',
              service: 'order-service',
              operation: 'POST /orders',
              startOffsetMs: 6,
              durationMs: 2095.0,
              status: 'error',
              statusCode: 504,
            },
            {
              id: '93564f3c20c3577e',
              traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
              parentSpanId: '5fb397be34d23b0f',
              service: 'payment-service',
              operation: 'POST /payments/charge',
              startOffsetMs: 18,
              durationMs: 2042.0,
              status: 'degraded',
              statusCode: 200,
            },
            {
              id: '71c82e6669911e99',
              traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
              parentSpanId: '5fb397be34d23b0f',
              service: 'orders-db',
              operation: 'INSERT INTO orders',
              startOffsetMs: 2065,
              durationMs: 4.5,
              status: 'ok',
              statusCode: 0,
            },
          ],
        },
      ],
      correlatedLogs: [
        {
          id: 'log-err-01',
          timestampIso: new Date(Date.now() - 75000).toISOString(),
          level: 'CRITICAL',
          service: 'payment-service',
          cluster: 'sandbox-alpha-us-east-1',
          traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
          durationMs: 2042.0,
          message: 'Toxiproxy transport latency delay injected: 2000ms on port 8080.',
          metadata: { 'chaos.fault': 'latency', 'chaos.magnitude': 2000 },
          spans: [],
        },
        {
          id: 'log-err-02',
          timestampIso: new Date(Date.now() - 74000).toISOString(),
          level: 'ERROR',
          service: 'order-service',
          cluster: 'sandbox-alpha-us-east-1',
          traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
          durationMs: 2095.0,
          message: 'Downstream HTTP call to payment-service exceeded 2000ms threshold: 504 Gateway Timeout.',
          metadata: { 'http.status': 504 },
          spans: [],
        },
      ],
    };
  }, [runningExperiments, experiments]);

  const p99DeltaPct = useMemo(() => {
    if (!latestPoint || !latestPoint.baselineP99) return 0;
    return ((latestPoint.p99 - latestPoint.baselineP99) / latestPoint.baselineP99) * 100;
  }, [latestPoint]);

  const totalRps = useMemo(
    () => services.reduce((acc, s) => acc + s.rps, 0),
    [services]
  );

  const avgErrorRate = useMemo(() => {
    const weighted = services.reduce((acc, s) => acc + s.errorRatePct * s.rps, 0);
    return totalRps > 0 ? weighted / totalRps : 0;
  }, [services, totalRps]);

  const minSloBudget = useMemo(
    () => Math.min(...services.map((s) => s.sloBudgetRemainingPct)),
    [services]
  );

  const filteredServices = useMemo(() => {
    return services
      .filter((s) => {
        if (statusFilter !== 'all' && s.status !== statusFilter) return false;
        if (
          searchQuery.trim() &&
          !s.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !s.namespace.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];
        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortAsc ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
      });
  }, [services, statusFilter, searchQuery, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-4 p-4 lg:p-6">
      {/* Page Title & Operational Context */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-[#fafafa]">
              Sandbox Telemetry
            </h1>
            <span className="rounded border border-[#10b981]/30 bg-[#10b981]/10 px-1.5 py-0.5 font-mono text-[9px] text-[#10b981]">
              ISOLATED SANDBOX
            </span>
            <span className="rounded border border-[#38bdf8]/30 bg-[#38bdf8]/10 px-1.5 py-0.5 font-mono text-[9px] text-[#38bdf8]">
              SIMULATED DATA
            </span>
          </div>
          <p className="mt-0.5 font-mono text-[11px] text-[#a1a1aa] tabular-nums">
            <span>{cluster}</span>
            <span className="mx-1.5 text-[#27272a]">·</span>
            <span>{services.length} mesh targets</span>
            <span className="mx-1.5 text-[#27272a]">·</span>
            <span>window {timeRange}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            data-testid="toggle-experiment-comparison-btn"
            type="button"
            onClick={() => setShowComparison(!showComparison)}
            className="flex items-center gap-1.5 rounded border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 font-mono text-[11px] text-indigo-400 hover:bg-indigo-500/20 transition-colors whitespace-nowrap shrink-0"
          >
            <Activity className="h-3.5 w-3.5" />
            <span>{showComparison ? 'Hide 3-Phase Correlation' : '3-Phase Experiment Correlation'}</span>
          </button>

          {runningExperiments.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('chaos')}
              className="flex items-center gap-2 rounded border border-[#f59e0b]/35 bg-[#f59e0b]/10 px-3 py-1.5 font-mono text-[11px] text-[#f59e0b] hover:bg-[#f59e0b]/15 transition-colors whitespace-nowrap shrink-0"
            >
              <Flame className="h-3.5 w-3.5 shrink-0" />
              <span className="tabular-nums">
                {runningExperiments.length} active fault{runningExperiments.length > 1 ? 's' : ''} injecting
              </span>
            </button>
          )}
        </div>
      </div>

      {/* 3-Phase Experiment Telemetry Comparison View */}
      {showComparison && (
        <ExperimentComparisonView
          correlation={sampleCorrelation}
          onClose={() => setShowComparison(false)}
        />
      )}

      {/* 4 Telemetry KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: p99 Latency */}
        <div
          className={`rounded-lg border bg-[#18181b] p-3.5 ${
            p99DeltaPct > 35 ? 'border-[#f59e0b]/40 fault-glow-amber' : 'border-[#27272a]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[#a1a1aa]">Mesh p99 Latency</span>
            <span
              className={`font-mono text-[11px] tabular-nums ${
                p99DeltaPct > 35 ? 'text-[#f59e0b]' : 'text-[#10b981]'
              }`}
            >
              {p99DeltaPct >= 0 ? '+' : ''}
              {p99DeltaPct.toFixed(1)}% vs base
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-display text-[22px] font-semibold tracking-tight text-[#fafafa] tabular-nums">
              {latestPoint?.p99.toFixed(1) ?? '0.0'}
            </span>
            <span className="font-mono text-[11px] text-[#71717a]">ms</span>
          </div>
          <div className="mt-2">
            <Sparkline
              data={series.slice(-20).map((d) => d.p99)}
              color={p99DeltaPct > 35 ? '#f59e0b' : '#6366f1'}
            />
          </div>
        </div>

        {/* Card 2: Error Rate */}
        <div
          className={`rounded-lg border bg-[#18181b] p-3.5 ${
            avgErrorRate > 0.4 ? 'border-[#f43f5e]/45 fault-glow-crimson' : 'border-[#27272a]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[#a1a1aa]">Weighted 5xx Rate</span>
            <span
              className={`font-mono text-[11px] tabular-nums ${
                avgErrorRate > 0.4 ? 'text-[#f43f5e]' : 'text-[#10b981]'
              }`}
            >
              {avgErrorRate > 0.4 ? 'SLO BREACH' : 'NOMINAL'}
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-display text-[22px] font-semibold tracking-tight text-[#fafafa] tabular-nums">
              {avgErrorRate.toFixed(2)}
            </span>
            <span className="font-mono text-[11px] text-[#71717a]">%</span>
          </div>
          <div className="mt-2">
            <Sparkline
              data={series.slice(-20).map((d) => d.errorRate)}
              color={avgErrorRate > 0.4 ? '#f43f5e' : '#10b981'}
            />
          </div>
        </div>

        {/* Card 3: Cluster Throughput */}
        <div className="rounded-lg border border-[#27272a] bg-[#18181b] p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[#a1a1aa]">Aggregate Throughput</span>
            <span className="font-mono text-[11px] text-[#38bdf8] tabular-nums">
              {prevPoint
                ? `${(((latestPoint.rps - prevPoint.rps) / prevPoint.rps) * 100).toFixed(1)}%`
                : '0.0%'}
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-display text-[22px] font-semibold tracking-tight text-[#fafafa] tabular-nums">
              {(totalRps / 1000).toFixed(1)}k
            </span>
            <span className="font-mono text-[11px] text-[#71717a]">req/s</span>
          </div>
          <div className="mt-2">
            <Sparkline data={series.slice(-20).map((d) => d.rps)} color="#38bdf8" />
          </div>
        </div>

        {/* Card 4: Lowest SLO Budget */}
        <div className="rounded-lg border border-[#27272a] bg-[#18181b] p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[#a1a1aa]">Min SLO Error Budget</span>
            <span
              className={`font-mono text-[11px] tabular-nums ${
                minSloBudget < 90 ? 'text-[#f43f5e]' : 'text-[#10b981]'
              }`}
            >
              30d rolling
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-display text-[22px] font-semibold tracking-tight text-[#fafafa] tabular-nums">
              {minSloBudget.toFixed(1)}
            </span>
            <span className="font-mono text-[11px] text-[#71717a]">% left</span>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="h-2 w-full overflow-hidden rounded-[2px] bg-[#09090b] border border-[#27272a]">
              <div
                className={`h-full transition-all ${
                  minSloBudget < 90 ? 'bg-[#f43f5e]' : 'bg-[#10b981]'
                }`}
                style={{ width: `${Math.max(4, minSloBudget)}%` }}
              />
            </div>
            <div className="flex justify-between font-mono text-[10px] text-[#71717a] tabular-nums">
              <span>Target 99.90%</span>
              <span>payment-ledger</span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Time-Series Correlation Panel */}
      <section className="rounded-lg border border-[#27272a] bg-[#18181b] p-4">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-[15px] font-semibold text-[#fafafa]">
              Latency Percentiles & Chaos Injection Correlation
            </h2>
            <p className="font-mono text-[11px] text-[#71717a]">
              Shaded amber intervals denote active fault injection windows across mesh ingress
            </p>
          </div>

          {/* Series Toggle Controls */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { key: 'p99', label: 'p99', color: '#f59e0b' },
                { key: 'p95', label: 'p95', color: '#6366f1' },
                { key: 'p50', label: 'p50', color: '#10b981' },
                { key: 'baseline', label: 'baseline', color: '#38bdf8' },
              ] as const
            ).map((item) => {
              const active = visibleSeries[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    setVisibleSeries((prev) => ({ ...prev, [item.key]: !prev[item.key] }))
                  }
                  className={`flex h-7 items-center gap-1.5 rounded border px-2.5 font-mono text-[11px] transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-[#27272a] bg-[#202024] text-[#fafafa]'
                      : 'border-[#27272a]/60 bg-[#111113] text-[#71717a]'
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-[1px]"
                    style={{ backgroundColor: active ? item.color : '#3f3f46' }}
                  />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <TimeSeriesChart data={series} visibleSeries={visibleSeries} />
      </section>

      {/* Service Health & Target Matrix */}
      <section className="rounded-lg border border-[#27272a] bg-[#18181b]">
        <div className="flex flex-col gap-3 border-b border-[#27272a] p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-[15px] font-semibold text-[#fafafa]">
              Service Target Matrix
            </h2>
            <span className="font-mono text-[11px] text-[#71717a] tabular-nums">
              {filteredServices.length} of {services.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#71717a]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter service or ns..."
                className="h-8 w-48 rounded border border-[#27272a] bg-[#111113] pl-8 pr-2.5 font-mono text-[12px] text-[#fafafa] placeholder:text-[#71717a] focus:border-[#6366f1] focus:outline-none"
              />
            </div>

            {/* Segmented Status Filter */}
            <div className="flex items-center rounded border border-[#27272a] bg-[#111113] p-0.5">
              {(['all', 'healthy', 'injecting', 'critical'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`h-6 rounded-[3px] px-2 font-mono text-[10px] uppercase tracking-[0.04em] transition-colors whitespace-nowrap shrink-0 ${
                    statusFilter === st
                      ? 'bg-[#202024] text-[#fafafa]'
                      : 'text-[#71717a] hover:text-[#a1a1aa]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#27272a] bg-[#111113] font-mono text-[10px] uppercase tracking-[0.04em] text-[#71717a]">
                <th className="px-3.5 py-2.5 font-medium">
                  <button
                    type="button"
                    onClick={() => handleSort('name')}
                    className="inline-flex items-center gap-1 hover:text-[#fafafa]"
                  >
                    Service / Namespace
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-3 py-2.5 font-medium">State</th>
                <th className="px-3 py-2.5 font-medium text-right">Pods</th>
                <th className="px-3 py-2.5 font-medium text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('rps')}
                    className="inline-flex items-center gap-1 hover:text-[#fafafa]"
                  >
                    Throughput
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-3 py-2.5 font-medium text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('p99Ms')}
                    className="inline-flex items-center gap-1 hover:text-[#fafafa]"
                  >
                    p99 Latency
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-3 py-2.5 font-medium text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('errorRatePct')}
                    className="inline-flex items-center gap-1 hover:text-[#fafafa]"
                  >
                    5xx Rate
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-3.5 py-2.5 font-medium text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('sloBudgetRemainingPct')}
                    className="inline-flex items-center gap-1 hover:text-[#fafafa]"
                  >
                    SLO Budget
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]">
              {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center font-mono text-[12px] text-[#71717a]">
                    No mesh targets match the current filter.{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter('all');
                        setSearchQuery('');
                      }}
                      className="text-[#38bdf8] hover:underline"
                    >
                      Reset filters
                    </button>
                  </td>
                </tr>
              ) : (
                filteredServices.map((svc) => (
                  <tr
                    key={svc.id}
                    onClick={() => onSelectService(svc)}
                    className="h-10 cursor-pointer transition-colors hover:bg-[#202024]"
                  >
                    <td className="px-3.5 py-2">
                      <div className="flex items-center gap-2 font-mono text-[12px]">
                        <span className="font-medium text-[#fafafa]">{svc.name}</span>
                        <span className="text-[#27272a]">/</span>
                        <span className="text-[#71717a]">{svc.namespace}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={svc.status} />
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[12px] text-[#a1a1aa] tabular-nums">
                      <span className={svc.podsReady < svc.podsTotal ? 'text-[#f43f5e]' : 'text-[#fafafa]'}>
                        {svc.podsReady}
                      </span>
                      /{svc.podsTotal}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[12px] text-[#fafafa] tabular-nums">
                      {svc.rps.toLocaleString()} rps
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[12px] tabular-nums">
                      <span
                        className={
                          svc.p99Ms > svc.baseP99Ms * 2
                            ? 'text-[#f59e0b] font-medium'
                            : 'text-[#fafafa]'
                        }
                      >
                        {svc.p99Ms.toFixed(1)} ms
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[12px] tabular-nums">
                      <span
                        className={
                          svc.errorRatePct > 0.5 ? 'text-[#f43f5e] font-medium' : 'text-[#a1a1aa]'
                        }
                      >
                        {svc.errorRatePct.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-3.5 py-2 text-right font-mono text-[12px] tabular-nums">
                      <span
                        className={
                          svc.sloBudgetRemainingPct < 90 ? 'text-[#f43f5e]' : 'text-[#10b981]'
                        }
                      >
                        {svc.sloBudgetRemainingPct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
