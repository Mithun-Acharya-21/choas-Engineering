# ChaosEngine AI — Experiment Telemetry Correlation (Milestone M6)

## 1. The Causation vs. Correlation Invariant

In complex distributed architectures, multiple incidents and telemetry anomalies can occur concurrently. A platform that assumes temporal correlation alone proves causation is prone to false positives (e.g., attributing a network partition to an unrelated background cron job).

ChaosEngine AI enforces **grounded causal verification** by binding every experiment to an immutable, time-correlated telemetry pack encompassing three continuous observation phases:

```
                  Experiment Execution Timeline
      ◄─────────────────── 3 x Duration ───────────────────►

  [ Phase 1: Baseline ]    [ Phase 2: Active Fault ]    [ Phase 3: Recovery ]
  Steady-state nominal     Chaos injected over proxy     Fault revoked; steady
  telemetry reference      (e.g., +2000ms latency)       state restored
  ───────────────────────┼─────────────────────────────┼───────────────────────
  T0 - duration          T0 (Fault Start)              T0 + duration (End)    T0 + 2*duration
```

---

## 2. Three-Phase Observation Windows

### Phase 1: Baseline Window ($T_{start} - \Delta t \to T_{start}$)
- **Purpose**: Establishes steady-state baseline performance immediately prior to disturbance.
- **Metrics Evaluated**: P50, P95, P99 latency, average RPS, baseline error rate, normal CPU/memory usage.
- **Invariant**: Verifies that the sandbox was healthy and nominal before chaos injection.

### Phase 2: Active Fault Injection Window ($T_{start} \to T_{end}$)
- **Purpose**: Measures system behavior, degradation, and failures directly caused by the injected toxic.
- **Metrics Evaluated**:
  - P99 latency spike magnitude: $\Delta P99 = \frac{P99_{active} - P99_{baseline}}{P99_{baseline}} \times 100\%$
  - 5xx error rate escalation (e.g. gateway timeouts).
  - Outlier traces exhibiting delayed spans on the targeted proxy.
  - Correlated critical/warning logs emitted during the interval.

### Phase 3: Recovery Window ($T_{end} \to T_{end} + \Delta t$)
- **Purpose**: Verifies that the microservice mesh successfully returned to nominal steady-state following fault removal.
- **Recovery Invariant**:
  $$\text{Recovered} \iff P99_{recovery} \le 1.25 \times P99_{baseline} \quad \land \quad \text{ErrorRate}_{recovery} \le 0.5\%$$

---

## 3. Telemetry Query Interface

The backend provides a dedicated endpoint for operators, UI dashboards, and automated RCA algorithms:

```http
GET /api/v1/telemetry/experiments/{experiment_id}?sandbox_id={sandbox_id}&target_service=payment-service&magnitude=2000.0
```

### Response Payload Structure:

```json
{
  "experiment_id": "exp-payment-latency-2000",
  "sandbox_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "target_service": "payment-service",
  "fault_type": "latency",
  "fault_magnitude": 2000.0,
  "fault_unit": "ms",
  "started_at": "2026-11-20T10:00:00Z",
  "completed_at": "2026-11-20T10:01:00Z",
  "baseline": {
    "phase": "baseline",
    "avg_p50_ms": 28.5,
    "avg_p95_ms": 52.0,
    "avg_p99_ms": 64.2,
    "avg_rps": 98.0,
    "avg_error_rate_pct": 0.01,
    "cpu_utilization_pct": 24.5,
    "memory_utilization_pct": 36.0
  },
  "fault_active": {
    "phase": "fault_active",
    "avg_p50_ms": 1820.0,
    "avg_p95_ms": 1980.0,
    "avg_p99_ms": 2064.2,
    "avg_rps": 72.0,
    "avg_error_rate_pct": 14.8,
    "cpu_utilization_pct": 68.0,
    "memory_utilization_pct": 58.5
  },
  "recovery": {
    "phase": "recovery",
    "avg_p50_ms": 29.2,
    "avg_p95_ms": 54.5,
    "avg_p99_ms": 66.8,
    "avg_rps": 96.5,
    "avg_error_rate_pct": 0.04,
    "cpu_utilization_pct": 26.0,
    "memory_utilization_pct": 37.5
  },
  "impact_delta_p99_pct": 3115.3,
  "recovered": true,
  "correlated_traces": [ /* W3C traces captured during fault window */ ],
  "correlated_logs": [ /* Error/warning logs captured during fault window */ ]
}
```

---

## 4. Integration with Downstream Milestones

1. **Milestone M7 (Automated Incident Detection)**:
   Continuously monitors Phase 2 metrics to detect when P99 latency or 5xx error rate violates project SLO budgets ($P99 > 500\text{ms}$ or $\text{ErrorRate} > 5\%$).
2. **Milestone M8 (Deterministic RCA Engine)**:
   Consumes the 3-phase evidence package to calculate temporal precedence and trace self-time ratios, identifying the primary root cause without hallucinations.
3. **Milestone M9 (AI Post-Mortem Report)**:
   Injects the validated baseline vs. fault vs. recovery statistics into the Groq LLM prompt to author evidence-grounded incident reports.
