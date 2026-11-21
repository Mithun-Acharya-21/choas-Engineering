# ChaosEngine AI — Milestone M7: Automated Incident Detection & SLO Violation Triage Architecture

## 1. Executive Summary

Milestone M7 delivers a deterministic, telemetry-driven incident detection and triage engine for ChaosEngine AI. Operating downstream of the Milestone M6 observability pipeline and Kubernetes sandboxes (M3), this engine continuously analyzes Prometheus metrics and health probes to detect SLO violations, latency breaches, availability deficits, and container saturation without human intervention.

Crucially, M7 separates **symptom detection, correlation, and evidence capture** from **root cause inference (RCA)**. By cataloging upstream and downstream symptoms deterministically through the M4 service topology graph and contextualizing them with M5 chaos fault injection metadata, M7 establishes the immutable, bounded evidentiary baseline required for the Groq AI RCA engine in Milestones M8 and M9.

---

## 2. Telemetry Pipeline Integration

```
+-----------------------------------------------------------------------------------------+
|                                KUBERNETES SANDBOX (M3)                                  |
|   +-------------------+       +--------------------+       +-----------------------+    |
|   |  api-gateway Pod  |       | order-service Pod  |       |  payment-service Pod  |    |
|   |  [App + Toxiproxy]| ----> |  [App + Toxiproxy] | ----> |   [App + Toxiproxy]   |    |
|   +---------+---------+       +---------+----------+       +-----------+-----------+    |
+-------------|---------------------------|------------------------------|----------------+
              | (OTel Exporter)           |                              |
              v                           v                              v
+-----------------------------------------------------------------------------------------+
|                                OBSERVABILITY PIPELINE (M6)                              |
|   +---------------------------------------------------------------------------------+   |
|   |  OpenTelemetry Collector Daemon (OTLP gRPC 4317 / HTTP 4318)                   |   |
|   +---------------------------------------+-----------------------------------------+   |
|                                           |                                             |
|        +----------------------------------+---------------------------------+           |
|        | (Metrics)                        | (Traces)                        | (Logs)    |
|        v                                  v                                 v           |
|   +-------------------+          +-------------------+             +----------------+   |
|   | Prometheus Engine |          |   Jaeger Engine   |             |  Loki Engine   |   |
|   +---------+---------+          +---------+---------+             +--------+-------+   |
+-------------|------------------------------|--------------------------------|-----------+
              | PromQL Queries               | Trace Extraction               | Log Snippets
              v                              v                                v
+-----------------------------------------------------------------------------------------+
|                         INCIDENT DETECTION & TRIAGE ENGINE (M7)                         |
|                                                                                         |
|   1. PromQL Telemetry Evaluator (Latency P99/P95, 5xx Error Rate, Pod Readiness, CPU)    |
|   2. Multi-Window SLO Burn Rate Calculator (14.4x Fast Burn, 6.0x Slow Burn)            |
|   3. Deterministic Alert Fingerprinter: sha256(sandbox_id:service:rule_family)[:16]     |
|   4. Hysteresis & Recovery Threshold Evaluator (Anti-Flapping Mechanism)                |
|   5. M4 Topology Dependency Correlator (Upstream/Downstream Symptom Propagation)       |
|   6. M5 Contextual Chaos Fault Correlator (Fault Type, Magnitude, Timing)              |
|   7. Bounded Evidence Packager (Metric Snapshots, Trace IDs, Log IDs, Freshness State)  |
|                                                                                         |
|                             LIFECYCLE STATE MACHINE                                     |
|             OPEN ----> ACKNOWLEDGED ----> INVESTIGATING ----> RESOLVED ----> CLOSED     |
|              ^                                                  |                       |
|              +---------------- Reopen Audit Event --------------+                       |
+-----------------------------------------------------------------------------------------+
```

---

## 3. Core Architectural Components

### 3.1. Telemetry Ingestion and Freshness Classification
Telemetry metrics sampled from Prometheus are evaluated for temporal freshness:
- **`FRESH`**: Sample age $\le 120\text{ seconds}$. Authoritative for real-time alerting and automated triage.
- **`UNCERTAIN`**: Sample age between $120\text{s}$ and $300\text{s}$. Flagged as potentially lagging.
- **`STALE`**: Sample age $> 300\text{ seconds}$. Suppresses automated incident creation and surfaces a platform warning regarding Prometheus scraper degradation.

### 3.2. Deterministic Detection vs LLM RCA
- **Deterministic Detection (M7)**: Uses hard mathematical rules, PromQL queries, SLO error budget consumption rates, and strict hysteresis. Does not guess or hallucinate causal connections.
- **Symptom Mapping (M7)**: Uses the directed acyclic graph (DAG) from M4 to identify upstream callers experiencing collateral degradation.
- **Root Cause Inference (M8/M9)**: Ingests the M7 `IncidentEvidencePackage` and computes causal attribution using graph algorithms and LLM synthesis.

### 3.3. Anti-Flapping and Deduplication
Recurring alert notifications can trigger severe alert fatigue. M7 addresses this with two mechanisms:
1. **Deterministic Fingerprints**: Every detected breach computes a stable SHA-256 fingerprint:
   $$\text{Fingerprint} = \text{SHA256}(\text{sandbox\_id} : \text{service\_id} : \text{rule\_family})[:16]$$
   If an open incident already matches this fingerprint, the system updates `last_detected_at` and increments `occurrence_count` rather than generating a duplicate ticket.
2. **Consecutive Breaches & Recovery Hysteresis**: Rules require 2 consecutive evaluation intervals above the threshold to trigger, and do not resolve until metrics fall strictly below a separate `recovery_threshold` (e.g. error rate $< 0.5\%$, P99 $< 120\text{ms}$).
