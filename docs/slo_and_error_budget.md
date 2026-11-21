# Service Level Objectives (SLO) & Error Budget Burn Rates (Milestone M7)

## 1. Overview

ChaosEngine AI implements Google SRE multi-window, multi-burn-rate alerting algorithms. Instead of relying on naive static threshold alerts that fire on brief network spikes, the platform measures how rapidly microservices are consuming their quarterly or monthly Error Budget.

---

## 2. Mathematical Formulations

### 2.1. Error Budget Ratio
For an availability SLO target of $A$ (e.g., $99.9\%$), the total allowable error budget ratio $B$ is:

$$B = \frac{100 - A}{100} = \frac{100 - 99.9}{100} = 0.001 \quad (0.1\%)$$

### 2.2. Observed Error Ratio
Given the observed percentage of HTTP 5xx responses $E_{\%}$ over a measurement window:

$$E_{\text{ratio}} = \frac{E_{\%}}{100}$$

### 2.3. Multi-Window Burn Rate
The burn rate multiplier $\beta$ represents how much faster the service is consuming its budget compared to the steady-state baseline:

$$\beta = \frac{E_{\text{ratio}}}{B} = \frac{E_{\%}}{100 - A}$$

---

## 3. Burn Rate Alerting Tiers

| Alert Tier | Burn Rate Multiplier ($\beta$) | Time to 100% Budget Exhaustion | Target Window | Severity | Trigger Threshold |
|---|---|---|---|---|---|
| **Fast Burn** | $14.4\times$ | 2 days (48 hours) | 1 hour | `CRITICAL` | Consumes $2\%$ of budget in 1 hour |
| **Slow Burn** | $6.0\times$ | 5 days (120 hours) | 6 hours | `WARNING` | Consumes $5\%$ of budget in 6 hours |
| **Normal Steady State**| $\le 1.0\times$ | 30 days | 24 hours | `INFO` | Operating within normal budget limits |

### Example: E-Commerce Sandbox Calculation
- Service: `payment-service`
- SLO: $99.9\%$ Availability ($B = 0.001$)
- Active Chaos Fault: Toxiproxy packet drop causing $1.44\%$ of HTTP calls to return 503 Service Unavailable.
- Calculated Burn Rate:
  $$\beta = \frac{0.0144}{0.001} = 14.4\times$$
- **Engine Action**: Triggers `RULE_SLO_FAST_BURN` with severity `CRITICAL`.
