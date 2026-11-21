import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  Activity,
  Cpu,
  Database,
  ExternalLink,
  Globe,
  HardDrive,
  Layers,
  Server,
  Zap,
} from 'lucide-react';
import { NodeType, TopologyNode } from '../../../types/domain/topology';

export interface ServiceNodeData extends TopologyNode {
  isSelected?: boolean;
  healthStatus?: 'healthy' | 'degraded' | 'injecting' | 'offline';
  activeExperimentsCount?: number;
}

const getNodeTheme = (type: NodeType) => {
  switch (type) {
    case 'api_gateway':
      return {
        badgeBg: 'bg-cyan-500/10',
        badgeText: 'text-cyan-400',
        border: 'border-cyan-500/30',
        activeBorder: 'border-cyan-400 ring-1 ring-cyan-400/40',
        icon: Globe,
        accentColor: '#06b6d4',
        label: 'API GATEWAY',
      };
    case 'postgres':
      return {
        badgeBg: 'bg-blue-500/10',
        badgeText: 'text-blue-400',
        border: 'border-blue-500/30',
        activeBorder: 'border-blue-400 ring-1 ring-blue-400/40',
        icon: Database,
        accentColor: '#3b82f6',
        label: 'POSTGRESQL',
      };
    case 'redis':
      return {
        badgeBg: 'bg-amber-500/10',
        badgeText: 'text-amber-400',
        border: 'border-amber-500/30',
        activeBorder: 'border-amber-400 ring-1 ring-amber-400/40',
        icon: Zap,
        accentColor: '#f59e0b',
        label: 'REDIS CACHE',
      };
    case 'external':
      return {
        badgeBg: 'bg-emerald-500/10',
        badgeText: 'text-emerald-400',
        border: 'border-emerald-500/30 border-dashed',
        activeBorder: 'border-emerald-400 ring-1 ring-emerald-400/40',
        icon: ExternalLink,
        accentColor: '#10b981',
        label: 'EXTERNAL',
      };
    case 'app_service':
    default:
      return {
        badgeBg: 'bg-indigo-500/10',
        badgeText: 'text-indigo-400',
        border: 'border-indigo-500/30',
        activeBorder: 'border-indigo-400 ring-1 ring-indigo-400/40',
        icon: Server,
        accentColor: '#6366f1',
        label: 'APP SERVICE',
      };
  }
};

export const ServiceNodeComponent: React.FC<NodeProps<any>> = memo(({ data, selected }) => {
  const nodeData = data as ServiceNodeData;
  const theme = getNodeTheme(nodeData.nodeType || 'app_service');
  const IconComponent = theme.icon;

  const health = nodeData.healthStatus || 'healthy';

  return (
    <div
      className={`relative w-[210px] rounded-lg bg-[#111113] p-3 text-zinc-100 transition-all duration-150 shadow-xl border ${
        selected ? theme.activeBorder : theme.border
      } hover:border-zinc-500`}
    >
      {/* Target Handle (Left) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-[#6366f1] !border-2 !border-[#09090b] transition hover:!scale-125"
      />

      {/* Header with Type Badge & Status Indicator */}
      <div className="flex items-center justify-between pb-2 border-b border-[#27272a]">
        <span
          className={`flex items-center gap-1.5 px-1.5 py-0.5 text-[9px] font-mono font-semibold rounded ${theme.badgeBg} ${theme.badgeText}`}
        >
          <IconComponent className="w-2.5 h-2.5" />
          {theme.label}
        </span>

        {/* Health status dot */}
        <div className="flex items-center gap-1">
          <span
            className={`w-2 h-2 rounded-full ${
              health === 'healthy'
                ? 'bg-emerald-400'
                : health === 'degraded'
                ? 'bg-amber-400 animate-pulse'
                : health === 'injecting'
                ? 'bg-rose-500 animate-ping'
                : 'bg-zinc-500'
            }`}
          />
          <span className="text-[9px] font-mono text-zinc-400 uppercase">{health}</span>
        </div>
      </div>

      {/* Service Name & Port */}
      <div className="mt-2 space-y-1">
        <h4 className="text-xs font-semibold text-zinc-100 truncate font-mono" title={nodeData.name}>
          {nodeData.name}
        </h4>
        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
          <span className="text-zinc-500 truncate" title={nodeData.id}>
            :{nodeData.containerPort}
          </span>
          <span className="text-zinc-400 flex items-center gap-1">
            <Layers className="w-3 h-3 text-zinc-500" />
            {nodeData.replicas || 1} rep
          </span>
        </div>
      </div>

      {/* Sidecar & Specs Pill */}
      <div className="mt-2.5 pt-2 border-t border-[#1f1f23] flex items-center justify-between text-[9px] font-mono text-zinc-500">
        <span className="flex items-center gap-1 text-indigo-400/90">
          <Zap className="w-2.5 h-2.5 text-indigo-400" /> toxiproxy:8080
        </span>
        <span className="truncate max-w-[80px]" title={nodeData.image}>
          {nodeData.image.split(':')[0].split('/').pop()}
        </span>
      </div>

      {/* Source Handle (Right) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-[#6366f1] !border-2 !border-[#09090b] transition hover:!scale-125"
      />
    </div>
  );
});
