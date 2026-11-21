import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  Cpu,
  Database,
  ExternalLink,
  Globe,
  HardDrive,
  Layers,
  Plus,
  Server,
  Shield,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { NodeType, TopologyNode } from '../../../types/domain/topology';

interface NodeInspectorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  node: TopologyNode | null;
  onUpdateNode: (updatedNode: TopologyNode) => void;
  onDeleteNode: (nodeId: string) => void;
  isReadOnly?: boolean;
}

const APPROVED_CATALOG_IMAGES = [
  'chaosengine/api-gateway:1.0.0',
  'chaosengine/order-service:1.0.0',
  'chaosengine/payment-service:1.0.0',
  'chaosengine/inventory-service:1.0.0',
  'chaosengine/notification-service:1.0.0',
  'postgres:16-alpine',
  'redis:7.2-alpine',
  'nginx:1.25-alpine',
  'chaosengine/external-mock:1.0.0',
];

export const NodeInspectorDrawer: React.FC<NodeInspectorDrawerProps> = ({
  isOpen,
  onClose,
  node,
  onUpdateNode,
  onDeleteNode,
  isReadOnly = false,
}) => {
  const [formData, setFormData] = useState<TopologyNode | null>(node);
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvVal, setNewEnvVal] = useState('');

  useEffect(() => {
    setFormData(node);
  }, [node]);

  if (!isOpen || !formData) return null;

  const handleChange = (field: keyof TopologyNode, value: any) => {
    if (isReadOnly) return;
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdateNode(updated);
  };

  const handleResourceChange = (field: string, value: string) => {
    if (isReadOnly) return;
    const updated = {
      ...formData,
      resourceLimits: {
        ...formData.resourceLimits,
        [field]: value,
      },
    };
    setFormData(updated);
    onUpdateNode(updated);
  };

  const handleHealthChange = (field: string, value: any) => {
    if (isReadOnly) return;
    const updated = {
      ...formData,
      healthCheck: {
        ...(formData.healthCheck || { path: '/health', port: formData.containerPort, initialDelaySeconds: 5, periodSeconds: 10 }),
        [field]: value,
      },
    };
    setFormData(updated);
    onUpdateNode(updated);
  };

  const handleAddEnvVar = () => {
    if (!newEnvKey.trim() || isReadOnly) return;
    const updated = {
      ...formData,
      envVars: {
        ...formData.envVars,
        [newEnvKey.trim().toUpperCase()]: newEnvVal.trim(),
      },
    };
    setFormData(updated);
    onUpdateNode(updated);
    setNewEnvKey('');
    setNewEnvVal('');
  };

  const handleRemoveEnvVar = (key: string) => {
    if (isReadOnly) return;
    const nextEnv = { ...formData.envVars };
    delete nextEnv[key];
    const updated = { ...formData, envVars: nextEnv };
    setFormData(updated);
    onUpdateNode(updated);
  };

  const hasSecretWarning = Object.keys(formData.envVars || {}).some(
    (k) => /password|secret|token|key/i.test(k) && formData.envVars[k].length > 8 && !formData.envVars[k].startsWith('$')
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-[#0e0e11] border-l border-[#27272a] h-full flex flex-col shadow-2xl text-zinc-100 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[#27272a] bg-[#111113] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-zinc-100 font-mono">{formData.name}</h2>
                {isReadOnly && (
                  <span className="px-2 py-0.5 text-[9px] font-mono rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                    READ ONLY
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 font-mono">ID: {formData.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-[#18181b] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* Secret Warning Alert */}
          {hasSecretWarning && (
            <div className="p-3 rounded bg-amber-950/40 border border-amber-800/50 flex items-start gap-2.5 text-amber-200 text-[11px]">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Security Advisory: </span>
                Environment configuration contains raw secret keys. Do not expose production credentials in the topology canvas.
              </div>
            </div>
          )}

          {/* Node General Info */}
          <div className="space-y-3">
            <h3 className="font-semibold text-zinc-400 uppercase text-[10px] tracking-wider">Service Identity</h3>

            <div>
              <label className="block text-zinc-400 mb-1">Display Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                disabled={isReadOnly}
                className="w-full px-3 py-1.5 bg-[#18181b] border border-[#27272a] rounded text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-zinc-400 mb-1">Service Type</label>
                <select
                  value={formData.nodeType}
                  onChange={(e) => handleChange('nodeType', e.target.value as NodeType)}
                  disabled={isReadOnly}
                  className="w-full px-2.5 py-1.5 bg-[#18181b] border border-[#27272a] rounded text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
                >
                  <option value="app_service">Application Service</option>
                  <option value="api_gateway">API Gateway</option>
                  <option value="postgres">PostgreSQL Database</option>
                  <option value="redis">Redis Cache</option>
                  <option value="external">External Dependency</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Port</label>
                <input
                  type="number"
                  min="1"
                  max="65535"
                  value={formData.containerPort}
                  onChange={(e) => handleChange('containerPort', Number(e.target.value))}
                  disabled={isReadOnly}
                  className="w-full px-3 py-1.5 bg-[#18181b] border border-[#27272a] rounded text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-zinc-400 mb-1">Approved Container Image</label>
              <select
                value={formData.image}
                onChange={(e) => handleChange('image', e.target.value)}
                disabled={isReadOnly}
                className="w-full px-2.5 py-1.5 bg-[#18181b] border border-[#27272a] rounded text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
              >
                {APPROVED_CATALOG_IMAGES.map((img) => (
                  <option key={img} value={img}>
                    {img}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-zinc-400 mb-1">Replicas</label>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.replicas}
                onChange={(e) => handleChange('replicas', Number(e.target.value))}
                disabled={isReadOnly}
                className="w-full px-3 py-1.5 bg-[#18181b] border border-[#27272a] rounded text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          {/* Compute Quotas */}
          <div className="space-y-3 pt-3 border-t border-[#27272a]">
            <h3 className="font-semibold text-zinc-400 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" /> Compute & Memory Limits
            </h3>
            <div className="grid grid-cols-2 gap-3 font-mono text-[11px]">
              <div>
                <label className="text-zinc-500 block mb-0.5">CPU Request</label>
                <input
                  type="text"
                  value={formData.resourceLimits.cpuRequest}
                  onChange={(e) => handleResourceChange('cpuRequest', e.target.value)}
                  disabled={isReadOnly}
                  className="w-full px-2 py-1 bg-[#18181b] border border-[#27272a] rounded text-zinc-200"
                />
              </div>
              <div>
                <label className="text-zinc-500 block mb-0.5">CPU Limit</label>
                <input
                  type="text"
                  value={formData.resourceLimits.cpuLimit}
                  onChange={(e) => handleResourceChange('cpuLimit', e.target.value)}
                  disabled={isReadOnly}
                  className="w-full px-2 py-1 bg-[#18181b] border border-[#27272a] rounded text-zinc-200"
                />
              </div>
              <div>
                <label className="text-zinc-500 block mb-0.5">Mem Request</label>
                <input
                  type="text"
                  value={formData.resourceLimits.memoryRequest}
                  onChange={(e) => handleResourceChange('memoryRequest', e.target.value)}
                  disabled={isReadOnly}
                  className="w-full px-2 py-1 bg-[#18181b] border border-[#27272a] rounded text-zinc-200"
                />
              </div>
              <div>
                <label className="text-zinc-500 block mb-0.5">Mem Limit</label>
                <input
                  type="text"
                  value={formData.resourceLimits.memoryLimit}
                  onChange={(e) => handleResourceChange('memoryLimit', e.target.value)}
                  disabled={isReadOnly}
                  className="w-full px-2 py-1 bg-[#18181b] border border-[#27272a] rounded text-zinc-200"
                />
              </div>
            </div>
          </div>

          {/* Health Check Probe */}
          <div className="space-y-3 pt-3 border-t border-[#27272a]">
            <h3 className="font-semibold text-zinc-400 uppercase text-[10px] tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" /> Health Check Probe
            </h3>
            <div className="grid grid-cols-2 gap-3 font-mono text-[11px]">
              <div>
                <label className="text-zinc-500 block mb-0.5">HTTP Path</label>
                <input
                  type="text"
                  value={formData.healthCheck?.path || '/health'}
                  onChange={(e) => handleHealthChange('path', e.target.value)}
                  disabled={isReadOnly}
                  className="w-full px-2 py-1 bg-[#18181b] border border-[#27272a] rounded text-zinc-200"
                />
              </div>
              <div>
                <label className="text-zinc-500 block mb-0.5">Initial Delay (s)</label>
                <input
                  type="number"
                  value={formData.healthCheck?.initialDelaySeconds || 5}
                  onChange={(e) => handleHealthChange('initialDelaySeconds', Number(e.target.value))}
                  disabled={isReadOnly}
                  className="w-full px-2 py-1 bg-[#18181b] border border-[#27272a] rounded text-zinc-200"
                />
              </div>
            </div>
          </div>

          {/* Environment Variables */}
          <div className="space-y-3 pt-3 border-t border-[#27272a]">
            <h3 className="font-semibold text-zinc-400 uppercase text-[10px] tracking-wider">
              Environment Configurations ({Object.keys(formData.envVars || {}).length})
            </h3>

            <div className="space-y-1.5 font-mono text-[11px]">
              {Object.entries(formData.envVars || {}).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between p-2 rounded bg-[#18181b] border border-[#27272a]">
                  <div className="truncate">
                    <span className="text-indigo-400 font-semibold">{key}: </span>
                    <span className="text-zinc-300">{val}</span>
                  </div>
                  {!isReadOnly && (
                    <button
                      onClick={() => handleRemoveEnvVar(key)}
                      className="text-zinc-500 hover:text-red-400 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {!isReadOnly && (
              <div className="flex gap-2 font-mono text-[11px] pt-1">
                <input
                  type="text"
                  placeholder="KEY"
                  value={newEnvKey}
                  onChange={(e) => setNewEnvKey(e.target.value)}
                  className="w-1/3 px-2 py-1 bg-[#18181b] border border-[#27272a] rounded text-zinc-200 uppercase placeholder-zinc-600"
                />
                <input
                  type="text"
                  placeholder="VALUE"
                  value={newEnvVal}
                  onChange={(e) => setNewEnvVal(e.target.value)}
                  className="flex-1 px-2 py-1 bg-[#18181b] border border-[#27272a] rounded text-zinc-200 placeholder-zinc-600"
                />
                <button
                  type="button"
                  onClick={handleAddEnvVar}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs flex items-center"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#27272a] bg-[#111113] flex items-center justify-between">
          {!isReadOnly ? (
            <button
              onClick={() => {
                onDeleteNode(formData.id);
                onClose();
              }}
              className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-900/30 rounded border border-red-800/40 transition flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Node</span>
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-[#18181b] hover:bg-zinc-800 rounded border border-[#27272a] transition"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
