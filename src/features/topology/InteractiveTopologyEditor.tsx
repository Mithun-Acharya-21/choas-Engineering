import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Background,
  Connection,
  Controls,
  Edge,
  MiniMap,
  Node,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  ExternalLink,
  Globe,
  History,
  Layers,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Search,
  Server,
  Shield,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { canManageProjects, canOperateSandboxes } from '../../context/rbac';
import { sandboxService } from '../../services/api/sandboxService';
import { topologyService } from '../../services/api/topologyService';
import { mockSandboxService } from '../../services/mock/mockSandboxService';
import { mockTopologyService } from '../../services/mock/mockTopologyService';
import { Sandbox } from '../../types/domain/sandbox';
import {
  NodeType,
  ProtocolType,
  ServiceTopology,
  TopologyEdge,
  TopologyNode,
  TopologyValidationResult,
  TopologyVersionRecord,
} from '../../types/domain/topology';
import { DeployTopologyModal } from './drawers/DeployTopologyModal';
import { NodeInspectorDrawer } from './drawers/NodeInspectorDrawer';
import { ValidationDrawer } from './drawers/ValidationDrawer';
import { VersionHistoryModal } from './drawers/VersionHistoryModal';
import { ProtocolEdgeComponent } from './edges/ProtocolEdgeComponent';
import { ServiceNodeComponent } from './nodes/ServiceNodeComponent';

const nodeTypes = {
  serviceNode: ServiceNodeComponent,
};

const edgeTypes = {
  protocolEdge: ProtocolEdgeComponent,
};

export const InteractiveTopologyEditor: React.FC = () => {
  const { activeTenant, activeProject, role, isMockMode } = useAuth();
  const topService = isMockMode ? mockTopologyService : topologyService;
  const sbxService = isMockMode ? mockSandboxService : sandboxService;

  const canEdit = canManageProjects(role) || canOperateSandboxes(role);
  const isReadOnly = !canEdit;

  // Topology state
  const [topology, setTopology] = useState<ServiceTopology | null>(null);
  const [nodes, setNodes, onNodesChangeHandler] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChangeHandler] = useEdgesState<Edge>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sandboxes for deployment
  const [sandboxes, setSandboxes] = useState<Sandbox[]>([]);
  const [isLoadingSandboxes, setIsLoadingSandboxes] = useState(false);

  // Validation & Drawers state
  const [validation, setValidation] = useState<TopologyValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isValidationOpen, setIsValidationOpen] = useState(false);

  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  const [versions, setVersions] = useState<TopologyVersionRecord[]>([]);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [isDeployOpen, setIsDeployOpen] = useState(false);

  // Load Topology
  const loadTopology = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const items = await topService.listTopologies(activeProject?.id);
      let activeTop: ServiceTopology;

      if (items.length > 0) {
        activeTop = items[0];
      } else {
        // Fallback default
        activeTop = await topService.getTopology('topo-ecommerce-default');
      }

      setTopology(activeTop);

      // Convert TopologyNode to ReactFlow Node
      const flowNodes: Node[] = (activeTop.nodes || []).map((n) => ({
        id: n.id,
        type: 'serviceNode',
        position: n.position || { x: 100, y: 100 },
        data: { ...n },
      }));

      // Convert TopologyEdge to ReactFlow Edge
      const flowEdges: Edge[] = (activeTop.edges || []).map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'protocolEdge',
        data: {
          protocol: e.protocol || 'HTTP',
          dependencyType: e.dependencyType || 'synchronous',
          port: e.port,
        },
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
      setHasUnsavedChanges(false);

      // Validate initial topology
      const val = await topService.validateTopology(activeTop.nodes, activeTop.edges);
      setValidation(val);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load topology');
    } finally {
      setIsLoading(false);
    }
  }, [topService, activeProject?.id]);

  useEffect(() => {
    loadTopology();
  }, [loadTopology]);

  // Load Sandboxes for deployment
  const loadSandboxes = useCallback(async () => {
    try {
      setIsLoadingSandboxes(true);
      const list = await sbxService.listSandboxes(activeProject?.id);
      setSandboxes(list);
    } catch {
      setSandboxes([]);
    } finally {
      setIsLoadingSandboxes(false);
    }
  }, [sbxService, activeProject?.id]);

  // React Flow Handlers
  const onNodesChange = useCallback(
    (changes: any) => {
      if (isReadOnly) return;
      onNodesChangeHandler(changes);
      setHasUnsavedChanges(true);
    },
    [isReadOnly, onNodesChangeHandler]
  );

  const onEdgesChange = useCallback(
    (changes: any) => {
      if (isReadOnly) return;
      onEdgesChangeHandler(changes);
      setHasUnsavedChanges(true);
    },
    [isReadOnly, onEdgesChangeHandler]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (isReadOnly || !connection.source || !connection.target) return;
      const newEdgeId = `edge-${connection.source}-${connection.target}-${Date.now().toString(36)}`;
      const newEdge: Edge = {
        id: newEdgeId,
        source: connection.source,
        target: connection.target,
        type: 'protocolEdge',
        data: {
          protocol: 'HTTP',
          dependencyType: 'synchronous',
        },
      };
      setEdges((eds) => {
        const next = [...eds, newEdge];
        setHasUnsavedChanges(true);
        return next;
      });
    },
    [isReadOnly]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const topNode = (node.data as unknown) as TopologyNode;
      setSelectedNode(topNode);
      setIsInspectorOpen(true);
    },
    []
  );

  // Add Node from Palette
  const handleAddNode = (type: NodeType) => {
    if (isReadOnly) return;
    const count = nodes.filter((n) => (n.data as any).nodeType === type).length + 1;
    const baseNames: Record<NodeType, { prefix: string; name: string; image: string; port: number }> = {
      api_gateway: { prefix: 'api-gateway', name: 'API Gateway', image: 'chaosengine/api-gateway:1.0.0', port: 8081 },
      app_service: { prefix: 'service', name: `Service ${count}`, image: 'chaosengine/order-service:1.0.0', port: 8081 },
      postgres: { prefix: 'postgres-db', name: `Postgres DB ${count}`, image: 'postgres:16-alpine', port: 5432 },
      redis: { prefix: 'redis-cache', name: `Redis Cache ${count}`, image: 'redis:7.2-alpine', port: 6379 },
      external: { prefix: 'external-api', name: `External API ${count}`, image: 'chaosengine/external-mock:1.0.0', port: 443 },
    };

    const config = baseNames[type];
    const newId = `${config.prefix}-${Math.random().toString(36).substring(2, 6)}`;

    const newNodeData: TopologyNode = {
      id: newId,
      name: `${config.name}`,
      nodeType: type,
      image: config.image,
      containerPort: config.port,
      replicas: 1,
      envVars: {},
      resourceLimits: { cpuRequest: '100m', cpuLimit: '500m', memoryRequest: '128Mi', memoryLimit: '512Mi' },
      healthCheck: { path: '/health', port: config.port, initialDelaySeconds: 5, periodSeconds: 10 },
      position: { x: 150 + Math.random() * 200, y: 150 + Math.random() * 150 },
    };

    const newFlowNode: Node = {
      id: newId,
      type: 'serviceNode',
      position: newNodeData.position,
      data: { ...newNodeData },
    };

    setNodes((nds) => [...nds, newFlowNode]);
    setHasUnsavedChanges(true);
  };

  // Node Property Updates
  const handleUpdateNode = (updated: TopologyNode) => {
    if (isReadOnly) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === updated.id) {
          return {
            ...n,
            position: updated.position || n.position,
            data: { ...updated },
          };
        }
        return n;
      })
    );
    setSelectedNode(updated);
    setHasUnsavedChanges(true);
  };

  const handleDeleteNode = (nodeId: string) => {
    if (isReadOnly) return;
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
    setIsInspectorOpen(false);
    setHasUnsavedChanges(true);
  };

  // Run Graph Validation
  const handleRunValidation = async () => {
    setIsValidating(true);
    try {
      const currentNodes = nodes.map((n) => (n.data as unknown) as TopologyNode);
      const currentEdges = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        protocol: ((e.data?.protocol as any) || 'HTTP') as ProtocolType,
        dependencyType: ((e.data?.dependencyType as any) || 'synchronous'),
        port: e.data?.port as number | undefined,
      }));

      const res = await topService.validateTopology(currentNodes, currentEdges);
      setValidation(res);
      setIsValidationOpen(true);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Validation request failed');
    } finally {
      setIsValidating(false);
    }
  };

  // Save Topology (Optimistic Concurrency)
  const handleSaveChanges = async () => {
    if (!topology || isReadOnly) return;
    setIsSaving(true);
    setSaveMessage(null);
    setErrorMessage(null);

    try {
      const currentNodes = nodes.map((n) => ({
        ...((n.data as unknown) as TopologyNode),
        position: n.position,
      }));
      const currentEdges = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        protocol: ((e.data?.protocol as any) || 'HTTP') as ProtocolType,
        dependencyType: ((e.data?.dependencyType as any) || 'synchronous'),
        port: e.data?.port as number | undefined,
      }));

      const updated = await topService.updateTopology(topology.id, {
        name: topology.name,
        expectedVersion: topology.version,
        nodes: currentNodes,
        edges: currentEdges,
        groups: topology.groups,
      });

      setTopology(updated);
      setHasUnsavedChanges(false);
      setSaveMessage(`Successfully saved version ${updated.version}`);
      setTimeout(() => setSaveMessage(null), 3000);

      // Re-run validation
      const val = await topService.validateTopology(updated.nodes, updated.edges);
      setValidation(val);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.detail || err?.message || 'Failed to save topology');
    } finally {
      setIsSaving(false);
    }
  };

  // Open Version History
  const handleOpenVersions = async () => {
    if (!topology) return;
    try {
      const list = await topService.getTopologyVersions(topology.id);
      setVersions(list);
      setIsVersionHistoryOpen(true);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load version history');
    }
  };

  // Revert Version
  const handleRevertVersion = async (targetVersion: number) => {
    if (!topology || isReadOnly) return;
    try {
      const reverted = await topService.revertTopologyVersion(topology.id, targetVersion);
      setTopology(reverted);

      const flowNodes: Node[] = (reverted.nodes || []).map((n) => ({
        id: n.id,
        type: 'serviceNode',
        position: n.position || { x: 100, y: 100 },
        data: { ...n },
      }));

      const flowEdges: Edge[] = (reverted.edges || []).map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'protocolEdge',
        data: {
          protocol: e.protocol || 'HTTP',
          dependencyType: e.dependencyType || 'synchronous',
          port: e.port,
        },
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
      setHasUnsavedChanges(false);
      setSaveMessage(`Reverted to snapshot version ${targetVersion}`);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to revert version');
    }
  };

  // Deploy to Sandbox
  const handleOpenDeploy = async () => {
    await loadSandboxes();
    setIsDeployOpen(true);
  };

  const handleDeployToSandbox = async (sandboxId: string) => {
    if (!topology) return;
    await topService.deployTopology(topology.id, sandboxId);
  };

  // Highlight filtered nodes on search
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return nodes;
    const q = searchQuery.toLowerCase();
    return nodes.map((n) => {
      const matches = n.id.toLowerCase().includes(q) || ((n.data as any).name || '').toLowerCase().includes(q);
      return {
        ...n,
        selected: matches,
      };
    });
  }, [nodes, searchQuery]);

  return (
    <div className="relative h-[calc(100vh-48px)] w-full flex flex-col bg-[#09090b] text-zinc-100 overflow-hidden">
      {/* Top Controls Toolbar */}
      <div className="h-14 border-b border-[#27272a] bg-[#111113] px-4 flex items-center justify-between gap-4 z-20 shrink-0">
        {/* Topology Title & Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-white truncate">
              Service Mesh Topology
            </h1>
            <span className="flex items-center gap-1 rounded border border-[#10b981]/30 bg-[#10b981]/10 px-1.5 py-0.5 font-mono text-[9px] text-[#10b981]">
              <Shield className="h-2.5 w-2.5" />
              SANDBOX ISOLATED
            </span>
            {topology && (
              <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">
                v{topology.version}
              </span>
            )}
            {hasUnsavedChanges && (
              <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                UNSAVED
              </span>
            )}
            {isReadOnly && (
              <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                VIEW ONLY
              </span>
            )}
          </div>
        </div>

        {/* Node Palette Buttons (Only for Editor roles) */}
        {!isReadOnly && (
          <div className="hidden lg:flex items-center gap-1.5 p-1 rounded-lg bg-[#18181b] border border-[#27272a] text-xs font-mono">
            <button
              data-testid="add-service-btn"
              onClick={() => handleAddNode('app_service')}
              className="px-2 py-1 hover:bg-[#27272a] hover:text-white text-zinc-300 rounded transition flex items-center gap-1 text-[11px]"
            >
              <Plus className="w-3 h-3 text-indigo-400" />
              <span>Service</span>
            </button>
            <button
              data-testid="add-gateway-btn"
              onClick={() => handleAddNode('api_gateway')}
              className="px-2 py-1 hover:bg-[#27272a] hover:text-white text-zinc-300 rounded transition flex items-center gap-1 text-[11px]"
            >
              <Plus className="w-3 h-3 text-cyan-400" />
              <span>Gateway</span>
            </button>
            <button
              data-testid="add-postgres-btn"
              onClick={() => handleAddNode('postgres')}
              className="px-2 py-1 hover:bg-[#27272a] hover:text-white text-zinc-300 rounded transition flex items-center gap-1 text-[11px]"
            >
              <Plus className="w-3 h-3 text-blue-400" />
              <span>Postgres</span>
            </button>
            <button
              data-testid="add-redis-btn"
              onClick={() => handleAddNode('redis')}
              className="px-2 py-1 hover:bg-[#27272a] hover:text-white text-zinc-300 rounded transition flex items-center gap-1 text-[11px]"
            >
              <Plus className="w-3 h-3 text-amber-400" />
              <span>Redis</span>
            </button>
            <button
              data-testid="add-external-btn"
              onClick={() => handleAddNode('external')}
              className="px-2 py-1 hover:bg-[#27272a] hover:text-white text-zinc-300 rounded transition flex items-center gap-1 text-[11px]"
            >
              <Plus className="w-3 h-3 text-emerald-400" />
              <span>External</span>
            </button>
          </div>
        )}

        {/* Search Bar & Actions */}
        <div className="flex items-center gap-2.5">
          {/* Node Search */}
          <div className="relative w-40 hidden sm:block">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#18181b] border border-[#27272a] rounded text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-mono transition"
            />
          </div>

          {/* Validation Status Button */}
          <button
            data-testid="validation-status-btn"
            onClick={handleRunValidation}
            className={`px-2.5 py-1.5 text-xs font-mono rounded border transition flex items-center gap-1.5 ${
              validation?.isValid
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-red-500/10 text-red-300 border-red-500/30 hover:bg-red-500/20'
            }`}
          >
            {validation?.isValid ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-red-400" />
            )}
            <span>{validation?.isValid ? 'Graph Valid' : `${validation?.errors.length || 0} Errors`}</span>
          </button>

          {/* Version History Button */}
          <button
            data-testid="version-history-btn"
            onClick={handleOpenVersions}
            title="Inspect version history and snapshots"
            className="p-1.5 text-zinc-400 hover:text-white bg-[#18181b] hover:bg-zinc-800 rounded border border-[#27272a] transition flex items-center"
          >
            <History className="w-4 h-4" />
          </button>

          {/* Save Button (Only for Editor roles) */}
          {!isReadOnly && (
            <button
              data-testid="save-topology-btn"
              onClick={handleSaveChanges}
              disabled={isSaving || !hasUnsavedChanges}
              className="px-3 py-1.5 text-xs font-medium text-zinc-200 hover:text-white bg-[#18181b] hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed rounded border border-[#27272a] transition flex items-center gap-1.5"
            >
              <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
              <span>Save</span>
            </button>
          )}

          {/* Deploy to Sandbox Button */}
          {!isReadOnly && (
            <button
              data-testid="deploy-topology-btn"
              onClick={handleOpenDeploy}
              disabled={!validation?.isValid}
              className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded shadow-lg shadow-indigo-600/20 transition flex items-center gap-1.5"
            >
              <Rocket className="w-3.5 h-3.5" />
              <span>Deploy</span>
            </button>
          )}
        </div>
      </div>

      {/* Save / Error Flash Messages */}
      {saveMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded bg-emerald-950/80 border border-emerald-600/50 text-xs font-mono text-emerald-200 shadow-xl flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>{saveMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded bg-red-950/80 border border-red-600/50 text-xs font-mono text-red-200 shadow-xl flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-red-400" />
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="ml-2 text-zinc-400 hover:text-white">✕</button>
        </div>
      )}

      {/* React Flow Interactive Canvas */}
      <div className="flex-1 w-full h-full relative">
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#09090b] text-xs font-mono text-zinc-500">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading service mesh topology...</span>
          </div>
        ) : (
          <ReactFlow
            nodes={filteredNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodesDraggable={!isReadOnly}
            nodesConnectable={!isReadOnly}
            elementsSelectable={true}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.2}
            maxZoom={2.0}
            className="bg-[#09090b]"
          >
            <Background color="#27272a" gap={24} size={1} />
            <Controls className="!bg-[#111113] !border-[#27272a] !fill-zinc-400 !rounded-lg" />
            <MiniMap
              className="!bg-[#111113] !border-[#27272a] !rounded-lg"
              nodeColor={(n: any) => {
                const type = n.data?.nodeType;
                if (type === 'api_gateway') return '#06b6d4';
                if (type === 'postgres') return '#3b82f6';
                if (type === 'redis') return '#f59e0b';
                if (type === 'external') return '#10b981';
                return '#6366f1';
              }}
              maskColor="rgba(9, 9, 11, 0.7)"
            />

            {/* Canvas Bottom Panel with Security Guarantee */}
            <Panel position="bottom-left" className="m-3">
              <div className="p-2 rounded bg-[#111113]/90 border border-[#27272a] backdrop-blur-sm text-[10px] font-mono text-zinc-400 flex items-center gap-2 shadow-lg">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zero-YAML Direct Deployment | Injected Toxiproxy Sidecars</span>
              </div>
            </Panel>
          </ReactFlow>
        )}
      </div>

      {/* Drawers & Modals */}
      <NodeInspectorDrawer
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        node={selectedNode}
        onUpdateNode={handleUpdateNode}
        onDeleteNode={handleDeleteNode}
        isReadOnly={isReadOnly}
      />

      <ValidationDrawer
        isOpen={isValidationOpen}
        onClose={() => setIsValidationOpen(false)}
        validation={validation}
        isValidating={isValidating}
      />

      <VersionHistoryModal
        isOpen={isVersionHistoryOpen}
        onClose={() => setIsVersionHistoryOpen(false)}
        versions={versions}
        currentVersion={topology?.version || 1}
        onRevertVersion={handleRevertVersion}
        isReadOnly={isReadOnly}
      />

      {topology && (
        <DeployTopologyModal
          isOpen={isDeployOpen}
          onClose={() => setIsDeployOpen(false)}
          topology={topology}
          sandboxes={sandboxes}
          validation={validation}
          onDeploy={handleDeployToSandbox}
          isLoadingSandboxes={isLoadingSandboxes}
        />
      )}
    </div>
  );
};
