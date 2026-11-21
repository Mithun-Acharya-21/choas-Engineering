# Deterministic RCA Scoring Model & Mathematical Formulation (Milestone M8)

## 1. Overview

The RCA scoring model calculates a deterministic causal attribution score $S \in [0.0, 100.0]$ for every observed microservice. The model decomposes into 6 orthogonal factors, each normalized to $[0.0, 1.0]$ and assigned a weight $w_i$ such that $\sum w_i = 1.0$.

$$\text{Score}(S) = \sum_{i=1}^{6} w_i \cdot F_i(S) \times 100$$

---

## 2. Factor Formulations & Definitions

### 2.1. Span Latency Contribution ($F_{\text{span}}$, $w = 0.25$)
Measures the service's **exclusive self-duration** within distributed trace waterfalls:

$$\text{SelfDuration}(S) = \text{Duration}(S) - \sum_{C \in \text{Children}(S)} \text{Duration}(C)$$

$$F_{\text{span}}(S) = \min\left(1.0, \frac{\text{SelfDuration}(S)}{1500.0\text{ ms}}\right)$$

*Rationale*: A caller waiting 2097ms on a downstream callee that took 2042ms has only $2097 - 2042 = 55\text{ms}$ self-duration. Its $F_{\text{span}}$ is near zero ($0.037$), whereas the callee's $F_{\text{span}}$ is near $1.0$ ($0.92$).

### 2.2. Temporal Anomaly Precedence ($F_{\text{time}}$, $w = 0.20$)
Measures the chronological order in which telemetry anomalies first breached steady-state thresholds:
- First degraded service in cluster: $F_{\text{time}} = 0.95$
- Secondary affected caller (collateral symptom): $F_{\text{time}} = 0.40$
- Incidental service: $F_{\text{time}} = 0.20$

### 2.3. Metric Anomaly Magnitude ($F_{\text{anom}}$, $w = 0.15$)
Evaluates P99 latency surge and HTTP 5xx error rate:

$$\Delta_{\text{P99}} = \frac{\text{P99}_{\text{observed}} - \text{P99}_{\text{baseline}}}{\text{P99}_{\text{baseline}}}$$

$$F_{\text{anom}}(S) = \min\left(1.0, \frac{\Delta_{\text{P99}}}{10.0} + \frac{\text{ErrorRate}_{\%}}{20.0}\right)$$

### 2.4. Topology Dependency Depth ($F_{\text{depth}}$, $w = 0.15$)
Topological distance from perimeter ingress roots ($D = 0$) to deep downstream dependencies ($D \ge 2$):

$$F_{\text{depth}}(S) = \min\left(1.0, \frac{D(S) + 1}{D_{\max} + 1}\right)$$

*Rationale*: Leaf services have higher causal likelihood of initiating latency or database lock contention; root gateways have lower causal likelihood and primarily experience downstream propagation.

### 2.5. Chaos Experiment Alignment & Timing ($F_{\text{exp}}$, $w = 0.15$)
Evaluates temporal and target alignment with active Milestone M5 chaos experiments:
- **Active Fault Target & Anomaly during experiment**: $F_{\text{exp}} = 0.95$
- **Pre-Existing Anomaly Penalty**: If telemetry breach began *before* the experiment was applied:
  $$F_{\text{exp}} = 0.30 \quad (\text{Reduced by } 68\%)$$
- **Non-Target Service**: $F_{\text{exp}} = 0.10$

### 2.6. Log Severity Concentration ($F_{\text{log}}$, $w = 0.10$)
Measures density of `CRITICAL` and `ERROR` log messages:

$$F_{\text{log}}(S) = \min\left(1.0, \frac{\text{Count}(\text{CRIT} + \text{ERROR})}{5}\right)$$

---

## 3. Confidence Classification Invariants

| Classification | Score Threshold | Evidence Completeness | Score Margin over #2 Candidate | Pre-Existing Anomaly Penalty |
|---|---|---|---|---|
| **`HIGH`** | $\ge 70.0$ | $\ge 80\%$ | $\Delta \ge 15.0$ points | No |
| **`MEDIUM`** | $\ge 50.0$ | $\ge 60\%$ | $\Delta \ge 5.0$ points | Any |
| **`LOW`** | $< 50.0$ | Any | Any | Any |
| **`INCONCLUSIVE`** | Any | Any | $\Delta < 5.0$ points | Ambiguous tie |
| **`INSUFFICIENT_EVIDENCE`** | N/A | $< 20\%$ | Zero anomalies | Stale or missing telemetry |
