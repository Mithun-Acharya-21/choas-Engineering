# RCA Multi-Scenario Validation Suite & Edge Cases (Milestone M8)

## 1. Overview

Milestone M8 validates the deterministic RCA engine across 7 distinct operational scenarios, encompassing both chaos-driven and non-chaos production incidents, telemetry dropouts, pre-existing anomalies, and cyclic dependency topologies.

---

## 2. Validation Scenarios Matrix

| Scenario ID | Test Condition | Expected Primary Cause | Expected Collateral Symptoms | Expected Confidence | Special Validation Check |
|---|---|---|---|---|---|
| **SCENARIO-1** | Baseline M7 Payment Latency Surge (Toxiproxy exp-9411) | `payment-service` | `order-service`, `api-gateway` | `HIGH` | Exclusive span duration $> 2000\text{ms}$ isolates leaf from callers. |
| **SCENARIO-2** | Non-Chaos Production Database Contention | `orders-db` | `order-service`, `api-gateway` | `HIGH` | Experiment alignment score is minimal; metric magnitude and span self-duration drive attribution. |
| **SCENARIO-3** | Pre-Existing Telemetry Anomaly before Experiment | `payment-service` | `order-service` | `MEDIUM` | `started_relative_to_experiment == "before"` heavily penalizes experiment causality factor from $0.95$ to $0.30$. |
| **SCENARIO-4** | Missing Distributed Traces (PromQL Snapshots Only) | `payment-service` | `order-service` | `MEDIUM` | Gracefully falls back to M7 PromQL snapshots; issues missing trace warning. |
| **SCENARIO-5** | Zero Observable Telemetry / Stale Telemetry | None | None | `INSUFFICIENT_EVIDENCE` | Suppresses speculative attribution; outputs actionable warning. |
| **SCENARIO-6** | Cyclic Microservice Topology (A -> B -> C -> A) | Initiating degraded node | Dependent cyclic nodes | `HIGH` | Tarjan's SCC cycle condensation prevents infinite BFS recursion. |
| **SCENARIO-7** | Ambiguous Simultaneous Double Fault | Top 2 nodes | Ingress gateway | `INCONCLUSIVE` | Score delta $< 5$ points triggers `INCONCLUSIVE` classification rather than false certainty. |

---

## 3. Detailed Walkthrough: Scenario 1 (Payment Latency Surge)

1. **Telemetry Input**:
   - `payment-service` span: $2042\text{ms}$ duration, $2032\text{ms}$ exclusive self-duration.
   - `order-service` span: $2097\text{ms}$ duration, $55\text{ms}$ exclusive self-duration.
   - `api-gateway` span: $2115\text{ms}$ duration, $18\text{ms}$ exclusive self-duration.
2. **Scoring Breakdown for `payment-service`**:
   - Span Latency Contribution ($w = 0.25$): $23.0\text{ pts}$ (Normalized $0.92$)
   - Temporal Precedence ($w = 0.20$): $19.0\text{ pts}$ (Normalized $0.95$)
   - Metric Anomaly Magnitude ($w = 0.15$): $13.2\text{ pts}$ (Normalized $0.88$)
   - Graph Dependency Depth ($w = 0.15$): $12.8\text{ pts}$ (Depth 2, Normalized $0.85$)
   - Experiment Alignment ($w = 0.15$): $14.2\text{ pts}$ (Target of exp-9411, Normalized $0.95$)
   - Log Severity Concentration ($w = 0.10$): $6.3\text{ pts}$ (Normalized $0.63$)
   - **Total Score**: $88.5 / 100$ $\to$ **`is_primary_cause = True` (HIGH CONFIDENCE)**
3. **Scoring Breakdown for `order-service`**:
   - Span Latency Contribution: $1.3\text{ pts}$ (Self-duration is only $55\text{ms}$, Normalized $0.05$)
   - Temporal Precedence: $8.0\text{ pts}$ (Collateral caller, Normalized $0.40$)
   - Metric Anomaly Magnitude: $12.0\text{ pts}$
   - Graph Dependency Depth: $7.5\text{ pts}$ (Depth 1)
   - Experiment Alignment: $1.5\text{ pts}$ (Not target)
   - Log Severity Concentration: $6.0\text{ pts}$
   - **Total Score**: $36.3 / 100$ $\to$ **`is_collateral_symptom = True`**
4. **Conclusion**:
   The engine mathematically proves that `order-service` spent $97.4\%$ of its time waiting on `payment-service`, correctly identifying `payment-service` as the root cause.
