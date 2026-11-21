"""Unit tests for Deterministic Incident Detection Engine, SLO Burn Rates, and Alert Catalog (M7)."""

from datetime import datetime, timedelta, timezone
from backend.app.domains.incident.detection import (
    DetectionEngine,
    STANDARD_ALERT_RULES,
)
from backend.app.domains.incident.models import (
    IncidentSeverity,
    RuleFamily,
)
from backend.app.domains.observability.models import (
    MetricPoint,
    ServiceHealthStatus,
)


def make_metric_point(
    timestamp: str,
    p50: float = 20.0,
    p95: float = 60.0,
    p99: float = 90.0,
    baseline_p99: float = 80.0,
    rps: float = 120.0,
    error_rate: float = 0.0,
    cpu_utilization_pct: float = 30.0,
    memory_utilization_pct: float = 40.0,
) -> MetricPoint:
    return MetricPoint(
        timestamp=timestamp,
        p50=p50,
        p95=p95,
        p99=p99,
        baseline_p99=baseline_p99,
        rps=rps,
        error_rate=error_rate,
        cpu_utilization_pct=cpu_utilization_pct,
        memory_utilization_pct=memory_utilization_pct,
    )


def test_standard_alert_rules_catalog():
    """Validates default alert rules catalog coverage across required families."""
    engine = DetectionEngine()
    families = {r.family for r in engine.rules}
    assert RuleFamily.LATENCY in families
    assert RuleFamily.ERROR_RATE in families
    assert RuleFamily.AVAILABILITY in families
    assert RuleFamily.RESOURCE in families
    assert RuleFamily.SLO_BURN_RATE in families

    for rule in engine.rules:
        assert rule.rule_id
        assert rule.threshold is not None
        assert rule.recovery_threshold is not None
        assert rule.consecutive_breaches >= 1


def test_latency_p99_critical_breach_detection():
    """Tests P99 latency breach triggering after consecutive evaluation breaches."""
    engine = DetectionEngine()
    now_iso = datetime.now(timezone.utc).isoformat()
    consecutive_counts = {}

    # Cycle 1: First breach (threshold > 500ms, value 620ms) - should not trigger yet (requires 2)
    metric_pt_1 = make_metric_point(
        timestamp=now_iso,
        p99=620.0,
    )
    triggered, recovered, freshness = engine.evaluate_metric_point(
        service_id="payment-service",
        metric_point=metric_pt_1,
        consecutive_breach_counts=consecutive_counts,
    )
    assert freshness == "FRESH"
    assert not any(r.rule_id == "RULE_LAT_P99_CRITICAL" for r in triggered)
    assert consecutive_counts.get("payment-service:RULE_LAT_P99_CRITICAL") == 1

    # Cycle 2: Second breach - now triggers RULE_LAT_P99_CRITICAL
    metric_pt_2 = make_metric_point(
        timestamp=now_iso,
        p99=680.0,
    )
    triggered, recovered, freshness = engine.evaluate_metric_point(
        service_id="payment-service",
        metric_point=metric_pt_2,
        consecutive_breach_counts=consecutive_counts,
    )
    assert any(r.rule_id == "RULE_LAT_P99_CRITICAL" for r in triggered)
    assert consecutive_counts.get("payment-service:RULE_LAT_P99_CRITICAL") == 2


def test_error_rate_breach_detection():
    """Tests HTTP 5xx error rate breach triggering when > 5.0%."""
    engine = DetectionEngine()
    now_iso = datetime.now(timezone.utc).isoformat()
    consecutive_counts = {}

    for _ in range(2):
        metric_pt = make_metric_point(
            timestamp=now_iso,
            error_rate=8.5,
        )
        triggered, _, _ = engine.evaluate_metric_point(
            service_id="order-service",
            metric_point=metric_pt,
            consecutive_breach_counts=consecutive_counts,
        )

    assert any(r.rule_id == "RULE_ERR_5XX_CRITICAL" for r in triggered)


def test_pod_readiness_failure_detection():
    """Tests immediate availability incident when pod readiness ratio < 1.0."""
    engine = DetectionEngine()
    now_iso = datetime.now(timezone.utc).isoformat()
    consecutive_counts = {}

    metric_pt = make_metric_point(timestamp=now_iso)
    health = ServiceHealthStatus(
        service_id="inventory-service",
        name="inventory-service",
        namespace="sandbox-ns",
        cluster="kind-sandbox-mesh",
        replicas_desired=2,
        replicas_ready=0,
        status="degraded",
    )

    triggered, _, _ = engine.evaluate_metric_point(
        service_id="inventory-service",
        metric_point=metric_pt,
        health_status=health,
        consecutive_breach_counts=consecutive_counts,
    )

    assert any(r.rule_id == "RULE_AVAIL_POD_READINESS" for r in triggered)


def test_cpu_saturation_warning():
    """Tests container CPU saturation warning when > 85%."""
    engine = DetectionEngine()
    now_iso = datetime.now(timezone.utc).isoformat()
    consecutive_counts = {}

    for _ in range(2):
        metric_pt = make_metric_point(
            timestamp=now_iso,
            cpu_utilization_pct=92.4,
        )
        triggered, _, _ = engine.evaluate_metric_point(
            service_id="api-gateway",
            metric_point=metric_pt,
            consecutive_breach_counts=consecutive_counts,
        )

    assert any(r.rule_id == "RULE_RESOURCE_CPU_SATURATION" for r in triggered)


def test_slo_burn_rate_calculation():
    """Tests multi-window burn rate math: burn_rate = observed_error_rate / error_budget."""
    engine = DetectionEngine()
    burn_14_4 = engine.calculate_burn_rate(error_rate_pct=1.44, target_availability_pct=99.9)
    assert 14.3 <= burn_14_4 <= 14.5

    burn_6 = engine.calculate_burn_rate(error_rate_pct=0.60, target_availability_pct=99.9)
    assert 5.9 <= burn_6 <= 6.1


def test_hysteresis_and_recovery_clearing():
    """Tests that dropping below recovery threshold resets counter and signals recovery."""
    engine = DetectionEngine()
    now_iso = datetime.now(timezone.utc).isoformat()
    consecutive_counts = {"payment-service:RULE_LAT_P99_CRITICAL": 3}

    metric_pt = make_metric_point(
        timestamp=now_iso,
        p99=85.0,  # Below recovery_threshold 120.0
    )
    triggered, recovered, freshness = engine.evaluate_metric_point(
        service_id="payment-service",
        metric_point=metric_pt,
        consecutive_breach_counts=consecutive_counts,
    )

    assert not triggered
    assert any(r.rule_id == "RULE_LAT_P99_CRITICAL" for r in recovered)
    assert consecutive_counts["payment-service:RULE_LAT_P99_CRITICAL"] == 0


def test_telemetry_freshness_classification():
    """Tests FRESH vs UNCERTAIN vs STALE telemetry classification based on sample age."""
    engine = DetectionEngine()
    now = datetime.now(timezone.utc)

    # 1. Fresh (10s old)
    fresh_pt = make_metric_point(timestamp=(now - timedelta(seconds=10)).isoformat())
    _, _, f1 = engine.evaluate_metric_point("svc", fresh_pt)
    assert f1 == "FRESH"

    # 2. Uncertain (180s old)
    uncertain_pt = make_metric_point(timestamp=(now - timedelta(seconds=180)).isoformat())
    _, _, f2 = engine.evaluate_metric_point("svc", uncertain_pt)
    assert f2 == "UNCERTAIN"

    # 3. Stale (400s old)
    stale_pt = make_metric_point(timestamp=(now - timedelta(seconds=400)).isoformat())
    _, _, f3 = engine.evaluate_metric_point("svc", stale_pt)
    assert f3 == "STALE"
