"""Comprehensive directed graph validation engine for microservice topologies."""

import re
from typing import Dict, List, Set, Tuple
from backend.app.domains.sandbox.safety import APPROVED_CONTAINER_IMAGES
from backend.app.domains.topology.models import (
    DependencyType,
    NodeType,
    ProtocolType,
    TopologyEdge,
    TopologyNode,
    TopologyValidationResult,
    ValidationErrorDetail,
    ValidationWarningDetail,
)

# RFC 1123 Subdomain regex for Kubernetes resource names
RFC_1123_PATTERN = re.compile(r"^[a-z0-9]([-a-z0-9]*[a-z0-9])?$")

# Extended approved image catalog for topology components
APPROVED_TOPOLOGY_IMAGES = APPROVED_CONTAINER_IMAGES.union({
    "postgres:16-alpine",
    "postgres:15-alpine",
    "redis:7.2-alpine",
    "nginx:1.25-alpine",
    "chaosengine/external-mock:1.0.0",
    "external/dependency",
})

SUSPICIOUS_SECRET_PATTERNS = re.compile(
    r"(password|secret|private_key|token|api_key|credential)",
    re.IGNORECASE,
)


class TopologyValidator:
    """Validates structural integrity, Kubernetes compatibility, and dependency semantics."""

    @classmethod
    def validate(
        cls,
        nodes: List[TopologyNode],
        edges: List[TopologyEdge],
    ) -> TopologyValidationResult:
        errors: List[ValidationErrorDetail] = []
        warnings: List[ValidationWarningDetail] = []
        detected_cycles: List[List[str]] = []

        node_map: Dict[str, TopologyNode] = {}
        seen_node_names: Set[str] = set()

        # 1. Validate Nodes
        for node in nodes:
            # Check Node ID RFC 1123 compliance
            if not RFC_1123_PATTERN.match(node.id):
                errors.append(
                    ValidationErrorDetail(
                        code="INVALID_NODE_ID_FORMAT",
                        message=(
                            f"Node ID '{node.id}' must be RFC 1123 compliant (lowercase alphanumeric and hyphens, "
                            "starting and ending with alphanumeric)."
                        ),
                        node_id=node.id,
                    )
                )

            # Check Duplicate Node ID
            if node.id in node_map:
                errors.append(
                    ValidationErrorDetail(
                        code="DUPLICATE_NODE_ID",
                        message=f"Duplicate node ID detected: '{node.id}'",
                        node_id=node.id,
                    )
                )
            else:
                node_map[node.id] = node

            # Check Duplicate Node Name
            clean_name = node.name.strip().lower()
            if clean_name in seen_node_names:
                errors.append(
                    ValidationErrorDetail(
                        code="DUPLICATE_NODE_NAME",
                        message=f"Duplicate service name detected: '{node.name}'. Kubernetes service names must be unique.",
                        node_id=node.id,
                    )
                )
            seen_node_names.add(clean_name)

            # Check Approved Container Image
            if not cls._is_approved_image(node.image, node.node_type):
                errors.append(
                    ValidationErrorDetail(
                        code="UNAPPROVED_CONTAINER_IMAGE",
                        message=(
                            f"Container image '{node.image}' is not permitted in sandbox topologies. "
                            "Only approved images from the platform catalog are allowed."
                        ),
                        node_id=node.id,
                    )
                )

            # Check Container Port
            if node.container_port < 1 or node.container_port > 65535:
                errors.append(
                    ValidationErrorDetail(
                        code="INVALID_PORT",
                        message=f"Container port {node.container_port} must be between 1 and 65535.",
                        node_id=node.id,
                    )
                )

            # Check Environment Variables for Exposed Raw Secrets
            for key, val in node.env_vars.items():
                if SUSPICIOUS_SECRET_PATTERNS.search(key):
                    # If value looks like an actual hardcoded secret rather than a reference or mock
                    if len(val) > 8 and not val.startswith(("$", "env:", "config:", "mock-", "test-", "dev-")):
                        warnings.append(
                            ValidationWarningDetail(
                                code="POTENTIAL_EXPOSED_SECRET",
                                message=(
                                    f"Environment variable '{key}' on node '{node.name}' appears to contain a raw secret value. "
                                    "Prefer configuration references or mock values in topology editor."
                                ),
                                node_id=node.id,
                            )
                        )

            # Check Health Check configuration
            if node.health_check:
                if node.health_check.port < 1 or node.health_check.port > 65535:
                    errors.append(
                        ValidationErrorDetail(
                            code="INVALID_HEALTH_CHECK_PORT",
                            message=f"Health check port {node.health_check.port} is invalid.",
                            node_id=node.id,
                        )
                    )
                if not node.health_check.path.startswith("/"):
                    errors.append(
                        ValidationErrorDetail(
                            code="INVALID_HEALTH_CHECK_PATH",
                            message=f"Health check path '{node.health_check.path}' must start with '/'.",
                            node_id=node.id,
                        )
                    )

        # 2. Validate Edges
        seen_edges: Set[Tuple[str, str]] = set()
        adj_list: Dict[str, List[TopologyEdge]] = {nid: [] for nid in node_map}

        for edge in edges:
            # Check Source & Target existence
            if edge.source not in node_map:
                errors.append(
                    ValidationErrorDetail(
                        code="UNKNOWN_SOURCE_NODE",
                        message=f"Edge '{edge.id}' references non-existent source node '{edge.source}'.",
                        edge_id=edge.id,
                    )
                )
            if edge.target not in node_map:
                errors.append(
                    ValidationErrorDetail(
                        code="UNKNOWN_TARGET_NODE",
                        message=f"Edge '{edge.id}' references non-existent target node '{edge.target}'.",
                        edge_id=edge.id,
                    )
                )

            # Check Self Connection
            if edge.source == edge.target:
                errors.append(
                    ValidationErrorDetail(
                        code="SELF_DEPENDENCY_PROHIBITED",
                        message=f"Node '{edge.source}' cannot have a directed connection to itself.",
                        edge_id=edge.id,
                        node_id=edge.source,
                    )
                )

            # Check Duplicate Edge
            edge_tuple = (edge.source, edge.target)
            if edge_tuple in seen_edges:
                errors.append(
                    ValidationErrorDetail(
                        code="DUPLICATE_EDGE",
                        message=f"Duplicate directed edge from '{edge.source}' to '{edge.target}'.",
                        edge_id=edge.id,
                    )
                )
            else:
                seen_edges.add(edge_tuple)

            if edge.source in node_map and edge.target in node_map:
                adj_list[edge.source].append(edge)

        # 3. Cycle Detection & Semantic Analysis
        detected_cycles = cls._find_cycles(adj_list)
        for cycle in detected_cycles:
            # Analyze cycle protocols
            cycle_edges: List[TopologyEdge] = []
            for i in range(len(cycle)):
                u = cycle[i]
                v = cycle[(i + 1) % len(cycle)]
                for e in adj_list.get(u, []):
                    if e.target == v:
                        cycle_edges.append(e)
                        break

            has_async = any(
                e.dependency_type == DependencyType.ASYNCHRONOUS or e.protocol == ProtocolType.AMQP
                for e in cycle_edges
            )

            cycle_str = " -> ".join(cycle + [cycle[0]])
            if has_async:
                warnings.append(
                    ValidationWarningDetail(
                        code="ASYNC_EVENT_CYCLE_DETECTED",
                        message=(
                            f"Legitimate cyclic dependency detected via asynchronous messaging: [{cycle_str}]. "
                            "Asynchronous decoupling allows safe bidirectional communication. "
                            "Ensure dead-letter queues and message idempotency are implemented."
                        ),
                        cycle=cycle,
                    )
                )
            else:
                warnings.append(
                    ValidationWarningDetail(
                        code="SYNCHRONOUS_CYCLE_WARNING",
                        message=(
                            f"Synchronous cyclic dependency detected: [{cycle_str}]. "
                            "Synchronous cycles can cause distributed deadlock and cascading request timeouts "
                            "under network latency or failure injection. Consider introducing asynchronous messaging or circuit breaking."
                        ),
                        cycle=cycle,
                    )
                )

        is_valid = len(errors) == 0
        return TopologyValidationResult(
            is_valid=is_valid,
            errors=errors,
            warnings=warnings,
            detected_cycles=detected_cycles,
            node_count=len(nodes),
            edge_count=len(edges),
        )

    @classmethod
    def _is_approved_image(cls, image: str, node_type: NodeType) -> bool:
        """Validates image against approved catalog or node-type defaults."""
        if not image or not image.strip():
            return False

        img = image.strip().lower()

        # Allow external virtual node placeholder
        if node_type == NodeType.EXTERNAL and ("external" in img or "mock" in img):
            return True

        # Check exact matches
        if img in APPROVED_TOPOLOGY_IMAGES:
            return True

        # Check approved prefixes
        allowed_prefixes = (
            "chaosengine/",
            "ghcr.io/shopify/toxiproxy",
            "docker.io/library/postgres",
            "postgres:",
            "docker.io/library/redis",
            "redis:",
            "docker.io/library/nginx",
            "nginx:",
            "docker.io/otel/",
        )
        return any(img.startswith(prefix) for prefix in allowed_prefixes)

    @classmethod
    def _find_cycles(cls, adj_list: Dict[str, List[TopologyEdge]]) -> List[List[str]]:
        """Finds elementary directed cycles in the graph using DFS."""
        visited: Dict[str, int] = {node: 0 for node in adj_list}  # 0=unvisited, 1=visiting, 2=visited
        path: List[str] = []
        cycles: List[List[str]] = []
        seen_cycle_sets: Set[Tuple[str, ...]] = set()

        def dfs(node: str):
            visited[node] = 1
            path.append(node)

            for edge in adj_list.get(node, []):
                neighbor = edge.target
                if neighbor not in visited:
                    continue
                if visited[neighbor] == 1:
                    # Cycle detected: extract cycle slice
                    idx = path.index(neighbor)
                    cycle_nodes = path[idx:]
                    sorted_tuple = tuple(sorted(cycle_nodes))
                    if sorted_tuple not in seen_cycle_sets:
                        seen_cycle_sets.add(sorted_tuple)
                        cycles.append(cycle_nodes)
                elif visited[neighbor] == 0:
                    dfs(neighbor)

            path.pop()
            visited[node] = 2

        for node in list(adj_list.keys()):
            if visited[node] == 0:
                dfs(node)

        return cycles
