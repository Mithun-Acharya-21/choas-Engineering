# RCA Graph Traversal & Propagation Algorithms (Milestone M8)

## 1. Overview

The `DependencyGraphAnalyzer` consumes the Milestone M4 service topology to construct directed call graphs, isolate feedback cycles using Tarjan's Strongly Connected Components (SCC) algorithm, and map failure propagation paths from root cause origins to upstream callers.

---

## 2. Directed Adjacency Model

Given microservice nodes $V$ and directed dependency edges $E \subseteq V \times V$:
- **Downstream Adjacency**: $(u, v) \in E$ denotes that service $u$ calls service $v$ (e.g. `order-service` calls `payment-service`).
- **Upstream Adjacency**: $v \to u$ denotes that service $u$ is an upstream caller of service $v$.

---

## 3. Cycle Condensation & Tarjan's SCC Algorithm

In microservice meshes, cyclic dependencies (e.g., $A \to B \to C \to A$) can occur due to bidirectional webhooks, event loops, or authentication token validation calls. Naive DFS or BFS traversals risk infinite recursion in cyclic topologies.

### Tarjan's Strongly Connected Components
1. Maintain DFS discovery index and low-link numbers for each node.
2. Push visited nodes onto an evaluation stack.
3. When a node's low-link equals its discovery index, pop all nodes in its component.
4. SCC components containing $|V_{\text{scc}}| > 1$ are recognized as valid feedback cycles.
5. In causal path tracing, cycles are visited at most once per path, terminating cleanly without loop degradation.

---

## 4. Failure Propagation Path Derivation

When a downstream service $S_{\text{origin}}$ (e.g., `payment-service`) experiences critical latency or timeout failures, failure propagates upward to all transitive callers $C \in \text{Upstream}(S_{\text{origin}})$.

### Shortest Directed Path Algorithm (BFS)
For each degraded upstream caller $C$:
1. Perform Breadth-First Search from $C$ to $S_{\text{origin}}$ along downstream edges.
2. Reconstruct the ordered path segments:
   $$P = [C, v_1, v_2, \dots, S_{\text{origin}}]$$
3. Compute cumulative propagation latency:
   $$\text{Delay}(P) = \sum_{v \in P} \text{ExclusiveLatency}(v)$$
4. Tag critical paths ($P_{\text{critical}}$) where hop latency exceeds SLA thresholds.

### Example E-Commerce Failure Path
- Primary Origin: `payment-service` ($+2000\text{ms}$ Toxiproxy latency)
- Derived Path 1: `order-service -> payment-service` (1 hop, $+2042\text{ms}$)
- Derived Path 2: `api-gateway -> order-service -> payment-service` (2 hops, $+2115\text{ms}$)
