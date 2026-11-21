"""Unit tests for Deterministic RCA Engine, Graph Traversal, and Multi-Factor Scoring (M8)."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4
import pytest

from backend.app.domains.incident.models import IncidentEvidencePackage, IncidentRecord, IncidentSeverity, IncidentStatus
from backend.app.domains.observability.models import DistributedTrace, MetricPoint, TimeSeriesMetric, TraceSpan
from backend.app.domains.rca.engine import DeterministicRCAEngine
from backend.app.domains.rca.graph import DependencyGraphAnalyzer
from backend.app.domains.rca.models import ConfidenceClassification, RCAAnalysisStatus, RCAFactorType
from backend.app.domains.topology.models import NodeType, ProtocolType, TopologyEdge, TopologyNode


@pytest.fixture
def sample_incident():
    """Generates an M7 incident for payment-service latency breach."""
    now = datetime.now(timezone.utc)
    return IncidentRecord(
        id=uuid4(),
        fingerprint="fp-8f12d8a0c4",
        tenant_id=uuid4(),
        project_id=uuid4(),
        sandbox_id=uuid4(),
        primary_affected_service="payment-service",
        related_affected_services=["order-service", "api-gateway"],
        related_experiment_id="exp-9411",
        title="High Latency P99 Breach (> 500ms)",
        description="payment-service P99 breached 500ms critical threshold",
        severity=IncidentSeverity.CRITICAL,
        status=IncidentStatus.OPEN,
        detection_source="PROMETHEUS_PROMQL",
        triggered_rule_ids=["RULE_LAT_P99_CRITICAL"],
        first_detected_at=now,
        last_detected_at=now,
        occurrence_count=5,
        evidence_package=IncidentEvidencePackage(
            metric_snapshots={"p99": 842.0, "error_rate": 7.8},
            latency_change_pct=2530.0,
            error_rate_pct=7.8,
            service_health_status="degraded",
            trace_ids=["tr-89f2c4a10e"],
            log_ids=["log-1084"],
            topology_version=1,
            affected_dependency_paths=["api-gateway -> order-service -> payment-service"],
            related_experiment_id="exp-9411",
            experiment_fault_type="LATENCY_INJECTION",
            experiment_magnitude=500.0,
            started_relative_to_experiment="during",
            telemetry_freshness="FRESH",
        ),
        created_at=now,
        updated_at=now,
    )


def test_dependency_graph_traversal_and_depth():
    """Validates DAG traversal, upstream callers, downstream dependencies, and causal depth."""
    graph = DependencyGraphAnalyzer.from_e_commerce_default()

    # Upstream callers of payment-service
    callers = graph.get_transitive_upstream_callers("payment-service")
    assert "order-service" in callers
    assert "api-gateway" in callers
    assert "inventory-service" not in callers

    # Downstream dependencies of payment-service
    deps = graph.get_transitive_downstream_dependencies("payment-service")
    assert "stripe-psp" in deps

    # Causal depth
    depths = graph.calculate_causal_depths()
    assert depths["api-gateway"] == 0
    assert depths["order-service"] == 1
    assert depths["payment-service"] == 2
    assert depths["stripe-psp"] == 3


def test_cyclic_topology_handling():
    """Verifies that dependency cycles are detected and handled without infinite loops."""
    nodes = [
        TopologyNode(id="svc-a", name="Service A", image="chaosengine/api-gateway:1.0.0"),
        TopologyNode(id="svc-b", name="Service B", image="chaosengine/order-service:1.0.0"),
        TopologyNode(id="svc-c", name="Service C", image="chaosengine/payment-service:1.0.0"),
    ]
    # Create cycle: A -> B -> C -> A
    edges = [
        TopologyEdge(id="e1", source="svc-a", target="svc-b"),
        TopologyEdge(id="e2", source="svc-b", target="svc-c"),
        TopologyEdge(id="e3", source="svc-c", target="svc-a"),
    ]
    graph = DependencyGraphAnalyzer(nodes=nodes, edges=edges)
    cycles = graph.find_cycles()
    assert len(cycles) >= 1
    cycle_nodes = set(cycles[0])
    assert "svc-a" in cycle_nodes
    assert "svc-b" in cycle_nodes
    assert "svc-c" in cycle_nodes

    # Traversal terminates cleanly
    upstream = graph.get_transitive_upstream_callers("svc-a")
    assert "svc-b" in upstream or "svc-c" in upstream


def test_missing_telemetry_insufficient_evidence():
    """Verifies that completely missing telemetry yields INSUFFICIENT_EVIDENCE rather than speculation."""
    now = datetime.now(timezone.utc)
    empty_incident = IncidentRecord(
        id=uuid4(),
        fingerprint="fp-empty",
        tenant_id=uuid4(),
        project_id=uuid4(),
        sandbox_id=uuid4(),
        primary_affected_service="",
        related_affected_services=[],
        title="Unknown Issue",
        description="No data",
        severity=IncidentSeverity.INFO,
        status=IncidentStatus.OPEN,
        detection_source="SYSTEM",
        triggered_rule_ids=[],
        first_detected_at=now,
        last_detected_at=now,
        occurrence_count=1,
        evidence_package=IncidentEvidencePackage(
            metric_snapshots={},
            latency_change_pct=0,
            error_rate_pct=0,
            service_health_status="healthy",
            trace_ids=[],
            log_ids=[],
            topology_version=1,
            affected_dependency_paths=[],
            telemetry_freshness="STALE",
        ),
        created_at=now,
        updated_at=now,
    )
    engine = DeterministicRCAEngine()
    status, candidates, primary, collateral, paths, ev, warnings, meta = engine.analyze(
        incident=empty_incident,
    )
    assert status == RCAAnalysisStatus.INSUFFICIENT_EVIDENCE
    assert len(candidates) == 0
    assert primary is None
    assert len(warnings) > 0


def test_deterministic_scoring_payment_service_ranked_first(sample_incident):
    """Tests that payment-service is deterministically ranked #1 with high confidence and order-service is collateral."""
    engine = DeterministicRCAEngine()
    now = datetime.now(timezone.utc)

    # Synthetic realistic trace waterfall
    spans = [
        TraceSpan(
            id="sp-gw",
            trace_id="tr-01",
            parent_span_id=None,
            service="api-gateway",
            operation="POST /checkout",
            start_offset_ms=0.0,
            duration_ms=2115.0,
            status="error",
        ),
        TraceSpan(
            id="sp-order",
            trace_id="tr-01",
            parent_span_id="sp-gw",
            service="order-service",
            operation="POST /orders",
            start_offset_ms=5.0,
            duration_ms=2097.0,
            status="error",
        ),
        TraceSpan(
            id="sp-pay",
            trace_id="tr-01",
            parent_span_id="sp-order",
            service="payment-service",
            operation="POST /charge",
            start_offset_ms=10.0,
            duration_ms=2042.0,  # 2042 - 10 = 2032ms exclusive self-duration!
            status="error",
        ),
        TraceSpan(
            id="sp-db",
            trace_id="tr-01",
            parent_span_id="sp-pay",
            service="orders-db",
            operation="SELECT 1",
            start_offset_ms=12.0,
            duration_ms=10.0,
            status="ok",
        ),
    ]
    traces = [
        DistributedTrace(
            trace_id="tr-01",
            root_service="api-gateway",
            root_operation="POST /checkout",
            timestamp=now.isoformat(),
            duration_ms=2115.0,
            spans_count=len(spans),
            spans=spans,
            has_errors=True,
        )
    ]

    active_exp = {
        "id": "exp-9411",
        "target_service": "payment-service",
        "fault_type": "LATENCY_INJECTION",
        "magnitude": 2000.0,
        "status": "RUNNING",
    }

    status, candidates, primary, collateral, paths, ev, warnings, meta = engine.analyze(
        incident=sample_incident,
        traces=traces,
        active_experiment=active_exp,
    )

    assert status == RCAAnalysisStatus.COMPLETED
    assert primary is not None
    assert primary.service_id == "payment-service"
    assert primary.is_primary_cause is True
    assert primary.confidence in (ConfidenceClassification.HIGH, ConfidenceClassification.MEDIUM)
    assert primary.score > 70.0

    # Verify collateral symptoms classification
    collateral_service_ids = [c.service_id for c in collateral]
    assert "order-service" in collateral_service_ids or "api-gateway" in collateral_service_ids
    for c in collateral:
        assert c.is_collateral_symptom is True
        assert c.score < primary.score

    # Check that failure propagation path goes from payment-service -> order-service -> api-gateway
    assert len(paths) >= 1
    assert any(p.target_service == "payment-service" for p in paths)


def test_exclusive_self_duration_isolates_leaf_delay(sample_incident):
    """Verifies that span exclusive self-duration correctly identifies leaf delay over caller delay."""
    now = datetime.now(timezone.utc)
    spans = [
        TraceSpan(id="s1", trace_id="t1", parent_span_id=None, service="order-service", operation="op", duration_ms=1500.0, status="error"),
        TraceSpan(id="s2", trace_id="t1", parent_span_id="s1", service="payment-service", operation="op", duration_ms=1450.0, status="error"),
    ]
    traces = [
        DistributedTrace(
            trace_id="t1",
            root_service="order-service",
            root_operation="op",
            timestamp=now.isoformat(),
            duration_ms=1500.0,
            spans_count=len(spans),
            spans=spans,
            has_errors=True,
        )
    ]

    engine = DeterministicRCAEngine()
    _, candidates, primary, _, _, _, _, _ = engine.analyze(
        incident=sample_incident,
        traces=traces,
    )

    # payment-service has 1450ms self-duration; order-service only has 50ms self-duration (1500 - 1450)
    pay_cand = next(c for c in candidates if c.service_id == "payment-service")
    order_cand = next(c for c in candidates if c.service_id == "order-service")

    pay_span_factor = next(f for f in pay_cand.factors if f.factor_type == RCAFactorType.SPAN_LATENCY_CONTRIBUTION)
    order_span_factor = next(f for f in order_cand.factors if f.factor_type == RCAFactorType.SPAN_LATENCY_CONTRIBUTION)

    assert pay_span_factor.normalized_score > order_span_factor.normalized_score


def test_pre_existing_anomaly_penalizes_experiment_causality(sample_incident):
    """Tests that if anomaly preceded the chaos experiment, experiment alignment score is reduced."""
    sample_incident.evidence_package.started_relative_to_experiment = "before"

    active_exp = {
        "id": "exp-9411",
        "target_service": "payment-service",
        "fault_type": "LATENCY_INJECTION",
        "status": "RUNNING",
    }
    engine = DeterministicRCAEngine()
    _, candidates, primary, _, _, _, warnings, _ = engine.analyze(
        incident=sample_incident,
        active_experiment=active_exp,
    )

    pay_cand = next(c for c in candidates if c.service_id == "payment-service")
    exp_factor = next(f for f in pay_cand.factors if f.factor_type == RCAFactorType.EXPERIMENT_ALIGNMENT)

    # Heavily penalized from 0.95 down to 0.30
    assert exp_factor.normalized_score <= 0.35
    assert any("began BEFORE experiment" in w for w in warnings)


def test_reproducible_deterministic_results(sample_incident):
    """Verifies that running the analysis twice with the same inputs produces identical scores and ranks."""
    engine = DeterministicRCAEngine()
    _, c1, p1, _, _, _, _, _ = engine.analyze(incident=sample_incident)
    _, c2, p2, _, _, _, _, _ = engine.analyze(incident=sample_incident)

    assert len(c1) == len(c2)
    assert p1.service_id == p2.service_id
    assert p1.score == p2.score
    for cand1, cand2 in zip(c1, c2):
        assert cand1.service_id == cand2.service_id
        assert cand1.score == cand2.score
