import React from 'react';

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  fill?: boolean;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  color = '#6366f1',
  height = 36,
  fill = true,
}) => {
  if (data.length < 2) return null;
  const width = 180;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padY = 4;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - padY - ((val - min) / range) * (height - padY * 2);
    return { x, y };
  });

  const linePath = points
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');

  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;
  const gradId = `spark-${color.replace('#', '')}-${height}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full overflow-visible"
      style={{ height }}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0.0} />
        </linearGradient>
      </defs>
      <line x1={0} y1={height - 1} x2={width} y2={height - 1} stroke="#27272a" strokeWidth={1} />
      {fill && <path d={areaPath} fill={`url(#${gradId})`} />}
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r={2.5}
        fill={color}
      />
    </svg>
  );
};
