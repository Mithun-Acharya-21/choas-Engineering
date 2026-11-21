"""Dependency Graph Traversal, Cycle Handling, and Failure Propagation Analysis (Milestone M8)."""

from collections import defaultdict, deque
from typing import Any, Dict, List, Optional, Set, Tuple

from backend.app.domains.rca.models import RCADependencyPath
from backend.app.domains.topology.models import TopologyEdge, TopologyNode


class DependencyGraphAnalyzer:
    """Analyzes microservice topology for failure propagation paths, causal depth, and cycle semantics."""

    def __init__(self, nodes: Optional[List[TopologyNode]] = None, edges: Optional[List[TopologyEdge]] = None):
        self.nodes = {n.id: n for n in (nodes or [])}
        self.downstream_adj: Dict[str, Set[str]] = defaultdict(set)
        self.upstream_adj: Dict[str, Set[str]] = defaultdict(set)
        self.edge_metadata: Dict[Tuple[str, str], TopologyEdge] = {}

        for edge in (edges or []):
            self.downstream_adj[edge.source].add(edge.target)
            self.upstream_adj[edge.target].add(edge.source)
            self.edge_metadata[(edge.source, edge.target)] = edge

        # Ensure all nodes exist in adjacency dictionaries
        for n_id in self.nodes:
            self.downstream_adj.setdefault(n_id, set())
            self.upstream_adj.setdefault(n_id, set())

    @classmethod
    def from_e_commerce_default(cls) -> "DependencyGraphAnalyzer":
        """Factory initializing the default 7-node e-commerce microservice topology graph."""
        from backend.app.domains.topology.models import NodeType, ProtocolType

        default_nodes = [
            TopologyNode(id="api-gateway", name="API Gateway", node_type=NodeType.API_GATEWAY, image="chaosengine/api-gateway:1.0.0"),
            TopologyNode(id="order-service", name="Order Service", node_type=NodeType.APP_SERVICE, image="chaosengine/order-service:1.0.0"),
            TopologyNode(id="payment-service", name="Payment Service", node_type=NodeType.APP_SERVICE, image="chaosengine/payment-service:1.0.0"),
            TopologyNode(id="inventory-service", name="Inventory Service", node_type=NodeType.APP_SERVICE, image="chaosengine/inventory-service:1.0.0"),
            TopologyNode(id="orders-db", name="Orders PostgreSQL", node_type=NodeType.POSTGRES, image="postgres:16-alpine"),
            TopologyNode(id="redis-cache", name="Redis Cache", node_type=NodeType.REDIS, image="redis:7.2-alpine"),
            TopologyNode(id="stripe-psp", name="Stripe PSP Mock", node_type=NodeType.EXTERNAL, image="chaosengine/external-mock:1.0.0"),
        ]

        default_edges = [
            TopologyEdge(id="e1", source="api-gateway", target="order-service", protocol=ProtocolType.HTTP),
            TopologyEdge(id="e2", source="api-gateway", target="inventory-service", protocol=ProtocolType.HTTP),
            TopologyEdge(id="e3", source="order-service", target="payment-service", protocol=ProtocolType.GRPC),
            TopologyEdge(id="e4", source="order-service", target="orders-db", protocol=ProtocolType.TCP),
            TopologyEdge(id="e5", source="payment-service", target="stripe-psp", protocol=ProtocolType.HTTP),
            TopologyEdge(id="e6", source="inventory-service", target="redis-cache", protocol=ProtocolType.TCP),
        ]

        return cls(nodes=default_nodes, edges=default_edges)

    def find_cycles(self) -> List[List[str]]:
        """Identifies cycles using Tarjan's Strongly Connected Components (SCC) algorithm.

        Cycle presence is supported and handled gracefully without assuming cycles are fatal errors.
        """
        index = 0
        indices: Dict[str, int] = {}
        lowlinks: Dict[str, int] = {}
        on_stack: Set[str] = set()
        stack: List[str] = []
        cycles: List[List[str]] = []

        def strongconnect(v: str):
            nonlocal index
            indices[v] = index
            lowlinks[v] = index
            index += 1
            stack.append(v)
            on_stack.add(v)

            for w in self.downstream_adj.get(v, set()):
                if w not in indices:
                    strongconnect(w)
                    lowlinks[v] = min(lowlinks[v], lowlinks[w])
                elif w in on_stack:
                    lowlinks[v] = min(lowlinks[v], indices[w])

            if lowlinks[v] == indices[v]:
                scc = []
                while True:
                    w = stack.pop()
                    on_stack.remove(w)
                    scc.append(w)
                    if w == v:
                        break
                if len(scc) > 1:
                    cycles.append(scc)

        for node_id in self.nodes:
            if node_id not in indices:
                strongconnect(node_id)

        return cycles

    def get_transitive_upstream_callers(self, service_id: str) -> List[str]:
        """Returns all services that directly or indirectly call the given service (BFS traversal)."""
        visited: Set[str] = set()
        queue = deque([service_id])

        while queue:
            curr = queue.popleft()
            for caller in self.upstream_adj.get(curr, set()):
                if caller not in visited and caller != service_id:
                    visited.add(caller)
                    queue.append(caller)

        return list(visited)

    def get_transitive_downstream_dependencies(self, service_id: str) -> List[str]:
        """Returns all services that the given service directly or indirectly depends on."""
        visited: Set[str] = set()
        queue = deque([service_id])

        while queue:
            curr = queue.popleft()
            for dep in self.downstream_adj.get(curr, set()):
                if dep not in visited and dep != service_id:
                    visited.add(dep)
                    queue.append(dep)

        return list(visited)

    def calculate_causal_depths(self) -> Dict[str, int]:
        """Calculates topological dependency depth from ingress roots (depth 0) to leaf services.

        Services with greater depth are downstream dependencies; failures originating there
        propagate backward to callers with lower depth.
        """
        # Ingress roots have no upstream callers
        roots = [nid for nid, callers in self.upstream_adj.items() if len(callers) == 0]
        if not roots:
            roots = list(self.nodes.keys())[:1]

        depths: Dict[str, int] = {nid: 0 for nid in self.nodes}
        queue = deque([(r, 0) for r in roots])
        visited: Set[str] = set(roots)

        while queue:
            curr, d = queue.popleft()
            depths[curr] = max(depths[curr], d)
            for child in self.downstream_adj.get(curr, set()):
                if child not in visited:
                    visited.add(child)
                    queue.append((child, d + 1))
                else:
                    depths[child] = max(depths[child], d + 1)

        return depths

    def trace_failure_propagation(
        self,
        fault_origin_service: str,
        degraded_services: Set[str],
        latency_map: Optional[Dict[str, float]] = None,
    ) -> List[RCADependencyPath]:
        """Traces how an anomaly originating at fault_origin_service propagates up to caller services."""
        propagation_paths: List[RCADependencyPath] = []
        l_map = latency_map or {}

        # For every degraded upstream caller, find the directed path from fault_origin up to caller
        upstream_callers = [s for s in degraded_services if s in self.get_transitive_upstream_callers(fault_origin_service)]

        for caller in upstream_callers:
            # Find path from caller -> ... -> fault_origin (the call chain)
            path = self._find_directed_path(caller, fault_origin_service)
            if path:
                # Accumulate propagation delay
                total_delay = sum(l_map.get(s, 0.0) for s in path)
                propagation_paths.append(
                    RCADependencyPath(
                        source_service=caller,
                        target_service=fault_origin_service,
                        hops=len(path) - 1,
                        propagation_delay_ms=total_delay,
                        is_critical_path=True,
                        path_segments=path,
                    )
                )

        return propagation_paths

    def _find_directed_path(self, start: str, end: str) -> Optional[List[str]]:
        """Finds shortest directed path from start to end using BFS."""
        if start == end:
            return [start]
        queue = deque([[start]])
        visited = {start}

        while queue:
            path = queue.popleft()
            last = path[-1]
            if last == end:
                return path
            for nxt in self.downstream_adj.get(last, set()):
                if nxt not in visited:
                    visited.add(nxt)
                    queue.append(path + [nxt])

        return None
