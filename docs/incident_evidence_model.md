# Incident Evidence Model & Downstream RCA Contract (Milestone M7)

## 1. Overview & Architectural Boundary

The `IncidentEvidencePackage` represents the immutable, bounded data container created at breach detection time. It preserves ground-truth telemetry snapshots, distributed trace IDs, and log references without pre-empting the Milestone M8 Root Cause Analysis engine.

---

## 2. Evidence Package JSON Schema

```json
{
  "metric_snapshots": {
    "p99": 842.6,
    "p50": 312.4,
    "error_rate": 7.8,
    "cpu_utilization_pct": 78.4,
    "burn_rate_1h": 14.8
  },
  "latency_change_pct": 2530.0,
  "error_rate_pct": 7.8,
  "service_health_status": "degraded",
  "trace_ids": [
    "tr-89f2c4a10e",
    "tr-77d19b02f4"
  ],
  "log_ids": [
    "log-1084",
    "log-1083"
  ],
  "topology_version": 1,
  "affected_dependency_paths": [
    "api-gateway -> order-service -> payment-service",
    "payment-service -> stripe-psp (external)"
  ],
  "related_experiment_id": "exp-9411",
  "experiment_fault_type": "LATENCY_INJECTION",
  "experiment_magnitude": 500.0,
  "started_relative_to_experiment": "during",
  "telemetry_freshness": "FRESH"
}
```

---

## 3. Data Invariants

1. **Deterministic Dependency Paths**: Extracted directly from the M4 microservice directed graph. Identifies upstream callers affected by downstream queue saturation or socket timeouts.
2. **Bounded Payload**: Contains IDs and references rather than megabytes of raw trace spans or log chunks, preventing database bloat.
3. **Temporal Linkage to Chaos Faults**: Tags whether the incident initiated `before`, `during`, or `after` an active M5 chaos experiment.
4. **Readiness for Milestone M8 RCA**: Provides the exact evidence bundle that the causal graph traversal and Groq AI inference models require to score root cause probability without re-querying ephemeral live telemetry.
