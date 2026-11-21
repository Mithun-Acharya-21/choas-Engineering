"""Unit tests for ChaosEngine AI Telemetry & Observability Engine (Milestone M6)."""

import pytest
from backend.app.domains.observability.engine import (
    DataSanitizer,
    ObservabilityService,
)
from backend.app.domains.observability.models import (
    LogLevel,
    TimeRange,
)


def test_data_sanitizer_redacts_sensitive_keys_and_tokens():
    """Verifies that DataSanitizer strips sensitive credentials and tokens."""
    dirty_metadata = {
        "user_password": "super-secret-password-123",
        "api_token": "token-xyz-890",
        "nested": {
            "jwt_secret": "my-jwt-secret",
            "normal_field": "safe-value",
        },
        "auth_header": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDN7PaACyL-5P4H5JvP3ymA1",
    }

    sanitized = DataSanitizer.sanitize_metadata(dirty_metadata)

    assert sanitized["user_password"] == "[REDACTED_SECRET]"
    assert sanitized["api_token"] == "[REDACTED_SECRET]"
    assert sanitized["nested"]["jwt_secret"] == "[REDACTED_SECRET]"
    assert sanitized["nested"]["normal_field"] == "safe-value"
    assert sanitized["auth_header"] == "[REDACTED_SECRET]"


def test_data_sanitizer_masks_inline_log_messages():
    """Verifies inline regex scrubbing of secrets in unstructured messages."""
    msg = "User login failed: password=mypassword123&token=abc Bearer secret-bearer-token"
    cleaned = DataSanitizer.sanitize_log_message(msg)

    assert "mypassword123" not in cleaned
    assert "secret-bearer-token" not in cleaned
    assert "password=[REDACTED]" in cleaned
    assert "Bearer [REDACTED_TOKEN]" in cleaned


def test_cardinality_guard_blocks_unbounded_labels():
    """Verifies high-cardinality guard prevents dangerous label dimensions."""
    valid, err = DataSanitizer.validate_label_cardinality({"service_id": "order-service", "status": "500"})
    assert valid is True
    assert err is None

    invalid, err = DataSanitizer.validate_label_cardinality({"user_id": "usr-12345", "service": "order-service"})
    assert invalid is False
    assert "user_id" in err


def test_observability_service_queries_metrics():
    """Verifies metrics generation across all time ranges."""
    svc = ObservabilityService()
    metrics = svc.get_service_metrics(
        sandbox_id="sbx-test-123",
        service_id="payment-service",
        time_range=TimeRange.RANGE_15M,
    )

    assert len(metrics) == 1
    point = metrics[0].points[-1]
    assert point.p50 > 0
    assert point.p95 >= point.p50
    assert point.p99 >= point.p95
    assert point.rps > 0
    assert point.error_rate >= 0.0


def test_observability_service_generates_w3c_traces_with_injected_fault():
    """Verifies distributed traces adhere to W3C Trace Context and reflect chaos latency."""
    svc = ObservabilityService()
    traces = svc.get_distributed_traces(
        sandbox_id="sbx-test-123",
        limit=5,
        fault_injected=True,
        fault_magnitude_ms=2000.0,
    )

    assert len(traces) == 5
    impacted_trace = traces[0]
    assert len(impacted_trace.trace_id) == 32  # 128-bit hex
    assert impacted_trace.has_errors is True
    assert impacted_trace.duration_ms > 2000.0

    # Verify span waterfall hierarchy: api-gateway -> order-service -> payment-service
    span_gw = next(s for s in impacted_trace.spans if s.service == "api-gateway")
    span_order = next(s for s in impacted_trace.spans if s.service == "order-service")
    span_payment = next(s for s in impacted_trace.spans if s.service == "payment-service")

    assert span_gw.parent_span_id is None
    assert span_order.parent_span_id == span_gw.id
    assert span_payment.parent_span_id == span_order.id
    assert span_payment.duration_ms >= 2000.0
    assert "00-" in span_gw.tags["w3c.traceparent"]


def test_observability_service_structured_logs_correlation():
    """Verifies structured logs include trace IDs and secret redaction."""
    svc = ObservabilityService()
    logs = svc.get_structured_logs(
        sandbox_id="sbx-test-123",
        service="order-service",
        limit=10,
        fault_injected=True,
    )

    assert len(logs) > 0
    for entry in logs:
        assert entry.service == "order-service"
        assert entry.trace_id is not None
        assert "[REDACTED_SECRET]" in entry.metadata["raw_token"]


def test_experiment_telemetry_correlation_computes_3_phase_windows():
    """Verifies 3-phase window summary calculation (Baseline vs Active Fault vs Recovery)."""
    svc = ObservabilityService()
    correlation = svc.get_experiment_correlation(
        experiment_id="exp-test-99",
        sandbox_id="sbx-test-123",
        target_service="payment-service",
        fault_type="latency",
        fault_magnitude=2000.0,
        fault_unit="ms",
        duration_seconds=60,
    )

    assert correlation.experiment_id == "exp-test-99"
    assert correlation.target_service == "payment-service"

    # 1. Baseline Phase
    assert correlation.baseline.phase == "baseline"
    assert correlation.baseline.avg_p99_ms < 100.0
    assert correlation.baseline.avg_error_rate_pct < 1.0

    # 2. Active Fault Phase
    assert correlation.fault_active.phase == "fault_active"
    assert correlation.fault_active.avg_p99_ms >= 2000.0
    assert correlation.fault_active.avg_error_rate_pct > 5.0
    assert correlation.impact_delta_p99_pct > 1000.0  # Massive spike

    # 3. Recovery Phase
    assert correlation.recovery.phase == "recovery"
    assert correlation.recovery.avg_p99_ms < 100.0
    assert correlation.recovery.avg_error_rate_pct < 1.0
    assert correlation.recovered is True

    # Correlated evidence
    assert len(correlation.correlated_traces) > 0
    assert len(correlation.correlated_logs) > 0
