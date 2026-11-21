"""Deterministic Detection Engine, Alert Rules, and Multi-Window SLO Burn Rate Evaluator (Milestone M7)."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from backend.app.domains.incident.models import (
    AlertRuleDefinition,
    IncidentSeverity,
    RuleFamily,
    ServiceSLODefinition,
)
from backend.app.domains.observability.models import (
    MetricPoint,
    ServiceHealthStatus,
)

# Standard Alert Rules Catalog
STANDARD_ALERT_RULES: List[AlertRuleDefinition] = [
    AlertRuleDefinition(
        rule_id="RULE_LAT_P99_CRITICAL",
        name="P99 Latency Critical Breach",
        family=RuleFamily.LATENCY,
        severity=IncidentSeverity.CRITICAL,
        metric_name="p99",
        operator=">",
        threshold=500.0,
        recovery_threshold=120.0,
        consecutive_breaches=2,
    ),
    AlertRuleDefinition(
        rule_id="RULE_LAT_P95_DEGRADED",
        name="P95 Latency Degradation",
        family=RuleFamily.LATENCY,
        severity=IncidentSeverity.WARNING,
        metric_name="p95",
        operator=">",
        threshold=250.0,
        recovery_threshold=80.0,
        consecutive_breaches=2,
    ),
    AlertRuleDefinition(
        rule_id="RULE_ERR_5XX_CRITICAL",
        name="Elevated HTTP 5xx Error Rate",
        family=RuleFamily.ERROR_RATE,
        severity=IncidentSeverity.CRITICAL,
        metric_name="error_rate",
        operator=">",
        threshold=5.0,
        recovery_threshold=0.5,
        consecutive_breaches=2,
    ),
    AlertRuleDefinition(
        rule_id="RULE_AVAIL_POD_READINESS",
        name="Pod Readiness Failure",
        family=RuleFamily.AVAILABILITY,
        severity=IncidentSeverity.CRITICAL,
        metric_name="readiness_ratio",
        operator="<",
        threshold=1.0,
        recovery_threshold=1.0,
        consecutive_breaches=1,
    ),
    AlertRuleDefinition(
        rule_id="RULE_RESOURCE_CPU_SATURATION",
        name="Container CPU Saturation",
        family=RuleFamily.RESOURCE,
        severity=IncidentSeverity.WARNING,
        metric_name="cpu_utilization_pct",
        operator=">",
        threshold=85.0,
        recovery_threshold=70.0,
        consecutive_breaches=2,
    ),
    AlertRuleDefinition(
        rule_id="RULE_SLO_FAST_BURN",
        name="SLO Fast Error Budget Burn Rate",
        family=RuleFamily.SLO_BURN_RATE,
        severity=IncidentSeverity.CRITICAL,
        metric_name="burn_rate_1h",
        operator=">",
        threshold=14.4,
        recovery_threshold=2.0,
        consecutive_breaches=1,
    ),
]


class DetectionEngine:
    """Evaluates Prometheus metrics and health probes against deterministic rules and SLO burn rates."""

    def __init__(self, rules: Optional[List[AlertRuleDefinition]] = None):
        self.rules = rules or STANDARD_ALERT_RULES
        self.service_slos: Dict[str, ServiceSLODefinition] = {
            "api-gateway": ServiceSLODefinition(service_id="api-gateway", p99_latency_target_ms=80.0),
            "order-service": ServiceSLODefinition(service_id="order-service", p99_latency_target_ms=100.0),
            "payment-service": ServiceSLODefinition(service_id="payment-service", p99_latency_target_ms=120.0),
            "inventory-service": ServiceSLODefinition(service_id="inventory-service", p99_latency_target_ms=90.0),
            "orders-db": ServiceSLODefinition(service_id="orders-db", p99_latency_target_ms=30.0),
        }

    def calculate_burn_rate(self, error_rate_pct: float, target_availability_pct: float = 99.9) -> float:
        """Calculates multi-window SLO burn rate:

        burn_rate = (observed_error_ratio) / (allowed_unavailability_budget)
        e.g. For 99.9% SLO, budget = 0.001 (0.1%).
        If error rate = 1.44%, burn_rate = 0.0144 / 0.001 = 14.4x (Fast Burn).
        """
        error_budget_ratio = max(0.0001, (100.0 - target_availability_pct) / 100.0)
        observed_error_ratio = (error_rate_pct / 100.0)
        return round(observed_error_ratio / error_budget_ratio, 2)

    def evaluate_metric_point(
        self,
        service_id: str,
        metric_point: MetricPoint,
        health_status: Optional[ServiceHealthStatus] = None,
        consecutive_breach_counts: Optional[Dict[str, int]] = None,
    ) -> Tuple[List[AlertRuleDefinition], List[AlertRuleDefinition], str]:
        """Evaluates a single telemetry sample against rules.

        Returns: (triggered_rules, recovered_rules, telemetry_freshness)
        """
        triggered_rules: List[AlertRuleDefinition] = []
        recovered_rules: List[AlertRuleDefinition] = []
        consecutive_counts = consecutive_breach_counts if consecutive_breach_counts is not None else {}

        # 1. Check Telemetry Freshness
        freshness = "FRESH"
        try:
            pt_dt = datetime.fromisoformat(metric_point.timestamp.replace("Z", "+00:00"))
            age_sec = (datetime.now(timezone.utc) - pt_dt).total_seconds()
            if age_sec > 300:
                freshness = "STALE"
            elif age_sec > 120:
                freshness = "UNCERTAIN"
        except Exception:
            freshness = "UNCERTAIN"

        # 2. Extract Metric Value Map
        slo_def = self.service_slos.get(service_id, ServiceSLODefinition(service_id=service_id))
        burn_rate = self.calculate_burn_rate(metric_point.error_rate, slo_def.availability_target_pct)

        readiness_ratio = 1.0
        if health_status:
            readiness_ratio = (
                health_status.replicas_ready / max(1, health_status.replicas_desired)
            )

        metric_values: Dict[str, float] = {
            "p50": metric_point.p50,
            "p95": metric_point.p95,
            "p99": metric_point.p99,
            "error_rate": metric_point.error_rate,
            "cpu_utilization_pct": metric_point.cpu_utilization_pct,
            "memory_utilization_pct": metric_point.memory_utilization_pct,
            "readiness_ratio": readiness_ratio,
            "burn_rate_1h": burn_rate,
        }

        # 3. Evaluate Each Alert Rule with Hysteresis
        for rule in self.rules:
            curr_val = metric_values.get(rule.metric_name)
            if curr_val is None:
                continue

            breached = False
            if rule.operator == ">" and curr_val > rule.threshold:
                breached = True
            elif rule.operator == ">=" and curr_val >= rule.threshold:
                breached = True
            elif rule.operator == "<" and curr_val < rule.threshold:
                breached = True
            elif rule.operator == "<=" and curr_val <= rule.threshold:
                breached = True

            rule_key = f"{service_id}:{rule.rule_id}"
            if breached:
                consecutive_counts[rule_key] = consecutive_counts.get(rule_key, 0) + 1
                if consecutive_counts[rule_key] >= rule.consecutive_breaches:
                    triggered_rules.append(rule)
            else:
                # Check for recovery below recovery threshold
                is_recovered = False
                if rule.operator in (">", ">=") and curr_val <= rule.recovery_threshold:
                    is_recovered = True
                elif rule.operator in ("<", "<=") and curr_val >= rule.recovery_threshold:
                    is_recovered = True

                if is_recovered:
                    consecutive_counts[rule_key] = 0
                    recovered_rules.append(rule)

        return triggered_rules, recovered_rules, freshness
