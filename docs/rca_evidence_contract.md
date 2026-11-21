# RCA Evidence Contract & Ingestion Specifications (Milestone M8)

## 1. Overview & Data Schema

The `RCAEvidence` model defines the normalized, traceable contract that links every score factor to authoritative upstream telemetry from Milestones M4, M5, M6, and M7.

---

## 2. Ingested Evidence Types

| Evidence Type | Origin System | Key Extracted Fields | Source Reference Format |
|---|---|---|---|
| `METRIC_ANOMALY` | M6 Prometheus / M7 Evidence | `p99`, `p50`, `error_rate`, `cpu_utilization_pct` | `prometheus:p99` |
| `TRACE_LATENCY_SPIKE` | M6 Jaeger Tracing | `span_id`, `trace_id`, `duration_ms`, `exclusive_duration_ms` | `jaeger:<trace_id>:<span_id>` |
| `LOG_ERROR_EVENT` | M6 Loki Structured Logs | `log_id`, `level`, `message`, `service` | `loki:<log_id>` |
| `CHAOS_FAULT_INJECTION` | M5 Chaos Engine | `experiment_id`, `fault_type`, `magnitude`, `status` | `chaos:<exp_id>` |
| `TOPOLOGY_EDGE` | M4 Topology Schema | `source`, `target`, `protocol`, `dependency_type` | `topology:<edge_id>` |

---

## 3. Normalized Evidence Item Example

```json
{
  "evidence_id": "ev-8f12d8a0",
  "evidence_type": "TRACE_LATENCY_SPIKE",
  "service_id": "payment-service",
  "timestamp": "2026-11-20T12:00:15Z",
  "details": {
    "span_id": "sp-04",
    "trace_id": "tr-89f2c4a10e",
    "duration_ms": 2042.0,
    "exclusive_duration_ms": 2032.0,
    "status": "error"
  },
  "source_reference": "jaeger:tr-89f2c4a10e:sp-04"
}
```

---

## 4. Contract Guarantees

1. **Traceability**: Every candidate score breakdown references valid `evidence_ids`.
2. **Immutable Snapshots**: Telemetry evidence is copied into the `RCAAnalysis` at runtime, ensuring historical repeatability even after live TSDB metrics age out.
3. **Secret Redaction**: All log messages and trace span tags are pre-sanitized by the `DataSanitizer` before inclusion in the evidence package.
