import React, { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getSmoothStepPath } from '@xyflow/react';
import { ProtocolType, DependencyType } from '../../../types/domain/topology';

export interface ProtocolEdgeData {
  protocol?: ProtocolType;
  dependencyType?: DependencyType;
  port?: number;
  onDeleteEdge?: (id: string) => void;
}

export const ProtocolEdgeComponent: React.FC<EdgeProps<any>> = memo((props) => {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    selected,
    data,
  } = props;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  const edgeData = (data || {}) as ProtocolEdgeData;
  const protocol = edgeData.protocol || 'HTTP';
  const isAsync = edgeData.dependencyType === 'asynchronous' || protocol === 'AMQP';

  const edgeColor = selected
    ? '#818cf8'
    : isAsync
    ? '#38bdf8'
    : protocol === 'TCP'
    ? '#94a3b8'
    : '#6366f1';

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: edgeColor,
          strokeWidth: selected ? 2.5 : 1.5,
          strokeDasharray: isAsync ? '5 5' : undefined,
          transition: 'stroke 0.2s, stroke-width 0.2s',
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan flex items-center gap-1"
        >
          <span
            className={`px-1.5 py-0.5 text-[9px] font-mono font-medium rounded border shadow-md transition ${
              selected
                ? 'bg-indigo-950 text-indigo-200 border-indigo-500 scale-105'
                : 'bg-[#18181b] text-zinc-300 border-[#27272a] hover:border-zinc-500'
            }`}
          >
            {protocol}
            {isAsync && <span className="ml-1 text-[8px] text-sky-400">async</span>}
          </span>
        </div>
      </EdgeLabelRenderer>
    </>
  );
});
