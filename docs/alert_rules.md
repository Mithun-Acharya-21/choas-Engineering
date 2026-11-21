# Standard Alert Rules Catalog & PromQL Specifications (Milestone M7)

## 1. Overview

Milestone M7 provides a standard alert rules catalog covering all 5 core incident rule families:
1. **Latency (P99 & P95)**
2. **Error Rate (HTTP 5xx)**
3. **Availability (Pod Readiness & Crash Loops)**
4. **Resource Saturation (CPU & Memory)**
5. **SLO Burn Rate (Multi-Window Error Budget Consumption)**

Each rule definition includes a trigger threshold, recovery threshold (hysteresis), and consecutive breach requirement to eliminate alert flapping.

---

## 2. Standard Alert Rules Catalog

| Rule ID | Rule Name | Family | Severity | Metric | Operator | Breach Threshold | Recovery Threshold | Consecutive Cycles |
|---|---|---|---|---|---|---|---|---|
| `RULE_LAT_P99_CRITICAL` | P99 Latency Critical Breach | `LATENCY` | `CRITICAL` | `p99` | `>` | $500.0\text{ ms}$ | $120.0\text{ ms}$ | 2 |
| `RULE_LAT_P95_DEGRADED` | P95 Latency Degradation | `LATENCY` | `WARNING` | `p95` | `>` | $250.0\text{ ms}$ | $80.0\text{ ms}$ | 2 |
| `RULE_ERR_5XX_CRITICAL` | Elevated HTTP 5xx Error Rate | `ERROR_RATE` | `CRITICAL` | `error_rate` | `>` | $5.0\%$ | $0.5\%$ | 2 |
| `RULE_AVAIL_POD_READINESS`| Pod Readiness Deficit | `AVAILABILITY` | `CRITICAL` | `readiness_ratio` | `<` | $1.0$ ($100\%$) | $1.0$ ($100\%$) | 1 |
| `RULE_RESOURCE_CPU_SATURATION` | Container CPU Saturation | `RESOURCE` | `WARNING` | `cpu_utilization_pct` | `>` | $85.0\%$ | $70.0\%$ | 2 |
| `RULE_SLO_FAST_BURN` | SLO Fast Burn Rate ($14.4\times$) | `SLO_BURN_RATE` | `CRITICAL` | `burn_rate_1h` | `>` | $14.4\times$ | $2.0\times$ | 1 |

---

## 3. PromQL Query Templates

### 3.1. P99 Latency by Microservice
```promql
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{namespace=~"sandbox-.*", service_id="$SERVICE"}[2m])) by (le)) * 1000
```

### 3.2. HTTP 5xx Error Rate Percentage
```promql
(sum(rate(http_requests_total{namespace=~"sandbox-.*", service_id="$SERVICE", status=~"5.."}[2m])) /
 sum(rate(http_requests_total{namespace=~"sandbox-.*", service_id="$SERVICE"}[2m]))) * 100
```

### 3.3. Pod Readiness Ratio
```promql
sum(kube_pod_status_ready{namespace=~"sandbox-.*", condition="true", pod=~"$SERVICE-.*"}) /
sum(kube_pod_status_phase{namespace=~"sandbox-.*", phase="Running", pod=~"$SERVICE-.*"})
```

### 3.4. Container CPU Utilization Percentage
```promql
(sum(rate(container_cpu_usage_seconds_total{namespace=~"sandbox-.*", container="app", pod=~"$SERVICE-.*"}[2m])) /
 sum(kube_pod_container_resource_limits{namespace=~"sandbox-.*", resource="cpu", container="app", pod=~"$SERVICE-.*"})) * 100
```
