import React, { useMemo, useState } from 'react';
import { TelemetryPoint } from '../types/telemetry';

interface TimeSeriesChartProps {
  data: TelemetryPoint[];
  visibleSeries: {
    p99: boolean;
    p95: boolean;
    p50: boolean;
    baseline: boolean;
  };
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({ data, visibleSeries }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 920;
  const height = 248;
  const pad = { top: 14, right: 16, bottom: 26, left: 46 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const { maxY, ticks } = useMemo(() => {
    const vals: number[] = [80];
    data.forEach((d) => {
      if (visibleSeries.p99) vals.push(d.p99);
      if (visibleSeries.p95) vals.push(d.p95);
      if (visibleSeries.p50) vals.push(d.p50);
      if (visibleSeries.baseline) vals.push(d.baselineP99);
    });
    const rawMax = Math.max(...vals);
    const roundedMax = Math.ceil(rawMax / 50) * 50;
    const step = roundedMax / 4;
    return {
      maxY: roundedMax,
      ticks: [0, step, step * 2, step * 3, roundedMax],
    };
  }, [data, visibleSeries]);

  const toX = (i: number) =>
    pad.left + (data.length > 1 ? (i / (data.length - 1)) * plotW : 0);
  const toY = (val: number) => pad.top + plotH - (val / maxY) * plotH;

  const buildPath = (getter: (d: TelemetryPoint) => number) =>
    data
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(getter(d)).toFixed(1)}`)
      .join(' ');

  // Identify contiguous faultActive windows to shade amber injection regions
  const faultSpans = useMemo(() => {
    const spans: { start: number; end: number }[] = [];
    let currentStart: number | null = null;
    data.forEach((d, idx) => {
      if (d.faultActive && currentStart === null) {
        currentStart = idx;
      } else if (!d.faultActive && currentStart !== null) {
        spans.push({ start: currentStart, end: idx - 1 });
        currentStart = null;
      }
    });
    if (currentStart !== null) {
      spans.push({ start: currentStart, end: data.length - 1 });
    }
    return spans;
  }, [data]);

  const activePoint = hoverIdx !== null ? data[hoverIdx] : null;

  return (
    <div className="relative w-full select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[248px] w-full overflow-visible"
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Horizontal gridlines only — zero vertical grid noise */}
        {ticks.map((t) => {
          const y = toY(t);
          return (
            <g key={t}>
              <line
                x1={pad.left}
                y1={y}
                x2={width - pad.right}
                y2={y}
                stroke="#27272a"
                strokeWidth={1}
              />
              <text
                x={pad.left - 8}
                y={y + 3}
                textAnchor="end"
                className="fill-[#71717a] font-mono text-[10px] tabular-nums"
              >
                {t}ms
              </text>
            </g>
          );
        })}

        {/* Active chaos injection window shading */}
        {faultSpans.map((span, idx) => {
          const x1 = toX(span.start);
          const x2 = toX(span.end);
          const w = Math.max(8, x2 - x1);
          return (
            <g key={idx}>
              <rect
                x={x1}
                y={pad.top}
                width={w}
                height={plotH}
                fill="rgba(245, 158, 11, 0.07)"
              />
              <line
                x1={x1}
                y1={pad.top}
                x2={x1}
                y2={pad.top + plotH}
                stroke="rgba(245, 158, 11, 0.45)"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
            </g>
          );
        })}

        {/* Series paths */}
        {visibleSeries.baseline && (
          <path
            d={buildPath((d) => d.baselineP99)}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={1.25}
            strokeDasharray="4 4"
            opacity={0.75}
          />
        )}
        {visibleSeries.p50 && (
          <path
            d={buildPath((d) => d.p50)}
            fill="none"
            stroke="#10b981"
            strokeWidth={1.5}
          />
        )}
        {visibleSeries.p95 && (
          <path
            d={buildPath((d) => d.p95)}
            fill="none"
            stroke="#6366f1"
            strokeWidth={1.75}
          />
        )}
        {visibleSeries.p99 && (
          <path
            d={buildPath((d) => d.p99)}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={2}
          />
        )}

        {/* X-axis sparse timestamp ticks */}
        {data.map((d, i) => {
          if (i % 6 !== 0 && i !== data.length - 1) return null;
          return (
            <text
              key={`${d.timestamp}-${i}`}
              x={toX(i)}
              y={height - 6}
              textAnchor={i === data.length - 1 ? 'end' : i === 0 ? 'start' : 'middle'}
              className="fill-[#71717a] font-mono text-[10px] tabular-nums"
            >
              {d.timestamp}
            </text>
          );
        })}

        {/* Hover crosshair */}
        {hoverIdx !== null && activePoint && (
          <g>
            <line
              x1={toX(hoverIdx)}
              y1={pad.top}
              x2={toX(hoverIdx)}
              y2={pad.top + plotH}
              stroke="#52525b"
              strokeWidth={1}
            />
            {visibleSeries.p99 && (
              <circle
                cx={toX(hoverIdx)}
                cy={toY(activePoint.p99)}
                r={3.5}
                fill="#f59e0b"
                stroke="#09090b"
                strokeWidth={1.5}
              />
            )}
            {visibleSeries.p95 && (
              <circle
                cx={toX(hoverIdx)}
                cy={toY(activePoint.p95)}
                r={3}
                fill="#6366f1"
                stroke="#09090b"
                strokeWidth={1.5}
              />
            )}
            {visibleSeries.p50 && (
              <circle
                cx={toX(hoverIdx)}
                cy={toY(activePoint.p50)}
                r={3}
                fill="#10b981"
                stroke="#09090b"
                strokeWidth={1.5}
              />
            )}
          </g>
        )}

        {/* Invisible hit targets per data point */}
        {data.map((_, i) => {
          const sliceW = plotW / Math.max(1, data.length - 1);
          return (
            <rect
              key={i}
              x={toX(i) - sliceW / 2}
              y={pad.top}
              width={sliceW}
              height={plotH}
              fill="transparent"
              className="cursor-crosshair"
              onMouseEnter={() => setHoverIdx(i)}
            />
          );
        })}
      </svg>

      {/* Crosshair Readout Overlay */}
      {hoverIdx !== null && activePoint && (
        <div
          className="pointer-events-none absolute top-2 z-20 rounded border border-[#27272a] bg-[#202024] px-3 py-2 font-mono text-[11px] overlay-elevation"
          style={{
            left: hoverIdx > data.length * 0.65 ? undefined : `${Math.min(72, (hoverIdx / data.length) * 100 + 4)}%`,
            right: hoverIdx > data.length * 0.65 ? `${Math.min(72, ((data.length - hoverIdx) / data.length) * 100 + 4)}%` : undefined,
          }}
        >
          <div className="mb-1.5 flex items-center justify-between gap-4 border-b border-[#27272a] pb-1 text-[#a1a1aa]">
            <span className="tabular-nums">{activePoint.timestamp} UTC</span>
            {activePoint.faultActive && (
              <span className="text-[10px] font-medium text-[#f59e0b]">FAULT ACTIVE</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 tabular-nums">
            {visibleSeries.p99 && (
              <>
                <span className="text-[#f59e0b]">p99 latency</span>
                <span className="text-right text-[#fafafa]">{activePoint.p99.toFixed(1)} ms</span>
              </>
            )}
            {visibleSeries.p95 && (
              <>
                <span className="text-[#6366f1]">p95 latency</span>
                <span className="text-right text-[#fafafa]">{activePoint.p95.toFixed(1)} ms</span>
              </>
            )}
            {visibleSeries.p50 && (
              <>
                <span className="text-[#10b981]">p50 latency</span>
                <span className="text-right text-[#fafafa]">{activePoint.p50.toFixed(1)} ms</span>
              </>
            )}
            {visibleSeries.baseline && (
              <>
                <span className="text-[#38bdf8]">baseline p99</span>
                <span className="text-right text-[#fafafa]">{activePoint.baselineP99.toFixed(1)} ms</span>
              </>
            )}
            <span className="text-[#a1a1aa]">throughput</span>
            <span className="text-right text-[#fafafa]">{activePoint.rps.toLocaleString()} rps</span>
          </div>
        </div>
      )}
    </div>
  );
};
