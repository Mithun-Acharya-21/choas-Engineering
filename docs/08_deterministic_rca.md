# ChaosEngine AI — Milestone M8: Deterministic Root Cause Analysis Engine Architecture

## 1. Executive Summary

Milestone M8 delivers a mathematically rigorous, evidence-grounded, and deterministic Root Cause Analysis (RCA) engine for ChaosEngine AI. Operating downstream of the Milestone M4 service topology, Milestone M5 chaos experiments, Milestone M6 telemetry pipeline, and Milestone M7 incident detection engine, M8 identifies, scores, and ranks candidate failure causes across distributed microservices running in Kubernetes sandboxes.

### Core Non-Negotiables
- **No LLM Hallucinations**: M8 does not use an LLM for causal inference. Every candidate, score factor, confidence level, and propagation edge is mathematically grounded in observable telemetry.
- **Explainable Scores**: No black-box scores. Every score is decomposed into explicit weighted factors (span self-duration, temporal precedence, anomaly magnitude, graph depth, experiment alignment, and log severity).
- **Collateral Symptom Separation**: A caller service suffering timeout errors because a downstream dependency is stalled is explicitly classified as a **collateral symptom**, preventing false attribution.

---

## 2. End-to-End RCA Pipeline

```
+---------------------------------------------------------------------------------------------------+
|                                      M7 INCIDENT TRIGGER                                          |
|   IncidentRecord: primary_affected_service, triggered_rules, evidence_package, timestamps         |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                  EVIDENCE INGESTION & NORMALIZATION                               |
|   1. M6 Prometheus TSDB: P99/P50 latency, 5xx error rate %, CPU %, readiness ratio                |
|   2. M6 Jaeger Distributed Traces: Span waterfalls, exclusive self-durations, error tags         |
|   3. M6 Loki Structured Logs: CRITICAL / ERROR events, timeout log signatures                      |
|   4. M5 Chaos Engine: Fault target, fault type (LATENCY/PACKET_LOSS), magnitude, [start, end]     |
|   5. M4 Service Topology: Nodes, directed dependency edges, protocols, version                   |
|   6. Telemetry Completeness & Freshness Check (Suppresses inference if STALE or empty)           |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                   DEPENDENCY GRAPH ANALYSIS                                       |
|   - Tarjan's Strongly Connected Components (SCC) Cycle Condensation                               |
|   - Transitive Upstream Callers & Downstream Dependencies Traversal                               |
|   - Topological Causal Depth Ranking (Perimeter Gateway = 0, Downstream Leaf = Max Depth)        |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                DETERMINISTIC MULTI-FACTOR SCORING                                 |
|   Score(S) = sum(w_i * Factor_i(S)) * 100                                                         |
|   - Span Exclusive Latency Contribution (w = 0.25)                                                |
|   - Temporal Anomaly Precedence (w = 0.20)                                                        |
|   - Metric Anomaly Magnitude (w = 0.15)                                                           |
|   - Topology Dependency Depth (w = 0.15)                                                          |
|   - Chaos Experiment Alignment & Timing (w = 0.15)                                                |
|   - Log Severity Concentration (w = 0.10)                                                         |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                    CANDIDATE RANKING & CLASSIFICATION                             |
|   - Rank 1 Candidate: is_primary_cause = True (Confidence: HIGH | MEDIUM | LOW | INCONCLUSIVE)    |
|   - Subsequent Candidates: is_collateral_symptom = True (Explains why downstream caused caller)   |
|   - Trace Failure Propagation Paths from Origin to Perimeter Callers                              |
|   - Generate Evidence References & Recommended Mitigation Actions                                 |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                      PERSISTENCE & REST API                                       |
|   - Immutable Historical Records: RCAAnalysis (_RCA_ANALYSES_DB)                                  |
|   - API Endpoints: /api/v1/incidents/{id}/rca/analyze, /candidates, /evidence, /propagation, /rerun|
|   - Obsidian Telemetry Workspace UI: Interactive Candidate Tree, Factor Breakdown & DAG Paths   |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. Telemetry Freshness & Evidence Completeness

The engine strictly rejects guessing when telemetry is absent:
- If zero metrics, traces, and logs are present, the analysis immediately returns `RCAAnalysisStatus.INSUFFICIENT_EVIDENCE`.
- If telemetry is marked `STALE` ($> 300\text{s}$ old), the engine attaches explicit warnings to the analysis metadata.
- Source references (e.g. `jaeger:tr-89f2c4a10e:sp-04`, `prometheus:p99`, `chaos:exp-9411`) are permanently attached to each normalized evidence item.
