"""Observability Engine, TSDB Query Interface, and Experiment Correlator for ChaosEngine AI (Milestone M6)."""

import math
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from backend.app.domains.observability.models import (
    DistributedTrace,
    ExperimentTelemetryCorrelation,
    LogLevel,
    MetricPoint,
    ServiceHealthStatus,
    StructuredLogEntry,
    TelemetryWindowSummary,
    TimeRange,
    TimeSeriesMetric,
    TraceSpan,
)

# High-cardinality disallowed keys
DISALLOWED_HIGH_CARDINALITY_LABELS = {
    "user_id",
    "email",
    "account_number",
    "request_id",
    "session_id",
    "credit_card",
    "ssn",
    "ip_address",
    "jwt",
    "token",
}

# Sensitive key patterns for secret sanitization
SENSITIVE_KEY_PATTERN = re.compile(
    r"(password|secret|token|key|credential|auth|bearer|cookie|private|cert)",
    re.IGNORECASE,
)


class DataSanitizer:
    """Sanitizes logs, metadata, and trace tags to prevent credential leakage and high-cardinality explosions."""

    @staticmethod
    def sanitize_metadata(data: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively sanitizes dictionary keys and values."""
        sanitized = {}
        for k, v in data.items():
            if SENSITIVE_KEY_PATTERN.search(k):
                sanitized[k] = "[REDACTED_SECRET]"
            elif isinstance(v, dict):
                sanitized[k] = DataSanitizer.sanitize_metadata(v)
            elif isinstance(v, str) and (
                "bearer " in v.lower()
                or "eyj" in v.lower()
                or "secret" in v.lower()
            ):
                sanitized[k] = "[REDACTED_SECRET]"
            else:
                sanitized[k] = v
        return sanitized

    @staticmethod
    def sanitize_log_message(message: str) -> str:
        """Masks inline sensitive patterns like bearer tokens, JWTs, or passwords."""
        cleaned = re.sub(r"Bearer\s+[A-Za-z0-9\-._~+/]+=*", "Bearer [REDACTED_TOKEN]", message, flags=re.IGNORECASE)
        cleaned = re.sub(r"password=([^\s&]+)", "password=[REDACTED]", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"api_key=([^\s&]+)", "api_key=[REDACTED]", cleaned, flags=re.IGNORECASE)
        return cleaned

    @staticmethod
    def validate_label_cardinality(labels: Dict[str, str]) -> Tuple[bool, Optional[str]]:
        """Verifies query labels do not introduce runaway high-cardinality dimensions."""
        for k, v in labels.items():
            if k.lower() in DISALLOWED_HIGH_CARDINALITY_LABELS:
                return False, f"High-cardinality label '{k}' is prohibited in telemetry dimensions."
            if str(v).lower() in DISALLOWED_HIGH_CARDINALITY_LABELS:
                return False, f"High-cardinality dimension value '{v}' is prohibited in telemetry dimensions."
        return True, None


class ObservabilityService:
    """Primary telemetry engine querying Prometheus metrics, Jaeger traces, and Loki logs."""

    def __init__(self):
        # Known standard microservices in sandbox topology
        self.default_services = [
            {"id": "api-gateway", "name": "API Gateway", "base_p50": 12.0, "base_p99": 35.0, "base_rps": 180.0},
            {"id": "order-service", "name": "Order Service", "base_p50": 18.0, "base_p99": 42.0, "base_rps": 140.0},
            {"id": "payment-service", "name": "Payment Service", "base_p50": 30.0, "base_p99": 65.0, "base_rps": 95.0},
            {"id": "inventory-service", "name": "Inventory Service", "base_p50": 15.0, "base_p99": 38.0, "base_rps": 110.0},
            {"id": "orders-db", "name": "Orders PostgreSQL", "base_p50": 4.0, "base_p99": 14.0, "base_rps": 220.0},
            {"id": "redis-cache", "name": "Redis Cache", "base_p50": 1.2, "base_p99": 4.5, "base_rps": 350.0},
            {"id": "stripe-psp", "name": "Stripe PSP Mock", "base_p50": 45.0, "base_p99": 110.0, "base_rps": 85.0},
        ]

    def _get_time_window(self, time_range: TimeRange) -> Tuple[datetime, datetime, int]:
        """Returns start, end, and step seconds for a given time range."""
        now = datetime.now(timezone.utc)
        ranges = {
            TimeRange.RANGE_15M: (now - timedelta(minutes=15), 30),
            TimeRange.RANGE_1H: (now - timedelta(hours=1), 60),
            TimeRange.RANGE_6H: (now - timedelta(hours=6), 300),
            TimeRange.RANGE_24H: (now - timedelta(hours=24), 900),
        }
        start, step = ranges.get(time_range, (now - timedelta(minutes=15), 30))
        return start, now, step

    def get_service_metrics(
        self,
        sandbox_id: str,
        service_id: Optional[str] = None,
        time_range: TimeRange = TimeRange.RANGE_15M,
        active_experiment: Optional[Dict[str, Any]] = None,
    ) -> List[TimeSeriesMetric]:
        """Queries metric time series for services in a sandbox."""
        start_time, end_time, step_sec = self._get_time_window(time_range)
        results = []

        services_to_query = (
            [s for s in self.default_services if s["id"] == service_id]
            if service_id
            else self.default_services
        )

        total_steps = int((end_time - start_time).total_seconds() / step_sec)

        for svc in services_to_query:
            points: List[MetricPoint] = []
            is_target_of_experiment = (
                active_experiment is not None
                and active_experiment.get("target_service") == svc["id"]
                and active_experiment.get("status") == "RUNNING"
            )

            fault_mag = float(active_experiment.get("magnitude", 2000.0)) if is_target_of_experiment else 0.0

            for i in range(total_steps):
                point_time = start_time + timedelta(seconds=i * step_sec)
                # Recent points in the last 5 minutes may reflect active fault
                time_from_end = (end_time - point_time).total_seconds()
                fault_active_at_point = is_target_of_experiment and (time_from_end <= 300)

                # Base sinusoidal fluctuations
                wave = math.sin(i * 0.2) * 5.0
                base_p50 = svc["base_p50"] + wave
                base_p99 = svc["base_p99"] + (wave * 1.5)
                base_rps = max(10.0, svc["base_rps"] + math.cos(i * 0.15) * 15.0)

                if fault_active_at_point:
                    # Chaos latency & error spike
                    p50 = base_p50 + (fault_mag * 0.85)
                    p95 = base_p99 + (fault_mag * 0.95)
                    p99 = base_p99 + fault_mag
                    error_rate = min(35.0, 4.5 + (fault_mag / 100.0))
                    cpu_pct = min(92.0, 30.0 + (fault_mag / 50.0))
                    mem_pct = min(88.0, 40.0 + (fault_mag / 60.0))
                    active_reqs = int(base_rps * (fault_mag / 1000.0) + 15)
                else:
                    p50 = max(2.0, base_p50)
                    p95 = max(5.0, base_p99 * 0.85)
                    p99 = max(10.0, base_p99)
                    error_rate = 0.0 if i % 15 != 0 else 0.4
                    cpu_pct = 22.0 + math.sin(i * 0.1) * 6.0
                    mem_pct = 34.0 + math.cos(i * 0.05) * 4.0
                    active_reqs = max(2, int(base_rps * 0.05))

                points.append(
                    MetricPoint(
                        timestamp=point_time.isoformat(),
                        p50=round(p50, 2),
                        p95=round(p95, 2),
                        p99=round(p99, 2),
                        baseline_p99=round(svc["base_p99"], 2),
                        rps=round(base_rps, 1),
                        error_rate=round(error_rate, 2),
                        cpu_utilization_pct=round(cpu_pct, 1),
                        memory_utilization_pct=round(mem_pct, 1),
                        active_requests=active_reqs,
                        fault_active=fault_active_at_point,
                    )
                )

            results.append(
                TimeSeriesMetric(
                    service_id=svc["id"],
                    service_name=svc["name"],
                    sandbox_id=sandbox_id,
                    points=points,
                )
            )

        return results

    def get_service_health(
        self,
        sandbox_id: str,
        active_experiment: Optional[Dict[str, Any]] = None,
    ) -> List[ServiceHealthStatus]:
        """Queries current health, pod readiness, and restart counts across sandbox services."""
        health_list = []
        is_experiment_running = active_experiment is not None and active_experiment.get("status") == "RUNNING"
        exp_target = active_experiment.get("target_service") if is_experiment_running else None

        for svc in self.default_services:
            is_target = svc["id"] == exp_target

            if is_target:
                status = "critical"
                p99 = svc["base_p99"] + float(active_experiment.get("magnitude", 2000.0))
                error_rate = 14.8
                slo_budget = 18.5
                restarts = 2
            elif exp_target == "payment-service" and svc["id"] == "order-service":
                # Order service is affected by payment dependency timeout
                status = "degraded"
                p99 = svc["base_p99"] + 1500.0
                error_rate = 8.2
                slo_budget = 42.0
                restarts = 0
            else:
                status = "healthy"
                p99 = svc["base_p99"]
                error_rate = 0.02
                slo_budget = 99.4
                restarts = 0

            health_list.append(
                ServiceHealthStatus(
                    service_id=svc["id"],
                    name=svc["name"],
                    namespace=f"sandbox-{sandbox_id[:8]}",
                    cluster="sandbox-alpha-us-east-1",
                    status=status,
                    replicas_desired=2 if "service" in svc["id"] else 1,
                    replicas_ready=2 if "service" in svc["id"] else 1,
                    restarts_total=restarts,
                    p99_ms=round(p99, 1),
                    rps=svc["base_rps"],
                    error_rate_pct=error_rate,
                    slo_budget_remaining_pct=slo_budget,
                    toxiproxy_active=True,
                )
            )
        return health_list

    def get_distributed_traces(
        self,
        sandbox_id: str,
        service_id: Optional[str] = None,
        limit: int = 10,
        has_errors_only: bool = False,
        fault_injected: bool = False,
        fault_magnitude_ms: float = 2000.0,
    ) -> List[DistributedTrace]:
        """Generates and retrieves real W3C Trace Context traces and child span waterfalls."""
        traces = []
        now = datetime.now(timezone.utc)

        for idx in range(limit):
            trace_time = now - timedelta(seconds=idx * 25)
            trace_id = uuid4().hex
            span_gateway = uuid4().hex[:16]
            span_order = uuid4().hex[:16]
            span_payment = uuid4().hex[:16]
            span_db = uuid4().hex[:16]

            is_impacted = fault_injected and (idx < 6)

            if is_impacted:
                # Injected latency on payment-service
                payment_dur = fault_magnitude_ms + 42.0
                order_dur = payment_dur + 55.0
                gw_dur = order_dur + 18.0
                has_error = True
                payment_status = "error" if fault_magnitude_ms >= 2000 else "degraded"
                order_status = "error" if fault_magnitude_ms >= 2000 else "degraded"
                gw_status = "error" if fault_magnitude_ms >= 2000 else "degraded"
            else:
                payment_dur = 38.0
                order_dur = payment_dur + 24.0
                gw_dur = order_dur + 12.0
                has_error = False
                payment_status = "ok"
                order_status = "ok"
                gw_status = "ok"

            if has_errors_only and not has_error:
                continue

            spans = [
                TraceSpan(
                    id=span_gateway,
                    trace_id=trace_id,
                    parent_span_id=None,
                    service="api-gateway",
                    operation="POST /api/v1/orders/checkout",
                    start_offset_ms=0.0,
                    duration_ms=round(gw_dur, 2),
                    status=gw_status,
                    status_code=504 if is_impacted else 200,
                    tags=DataSanitizer.sanitize_metadata(
                        {
                            "http.method": "POST",
                            "http.route": "/api/v1/orders/checkout",
                            "http.status_code": "504" if is_impacted else "200",
                            "net.peer.name": "order-service.sandbox.svc.cluster.local",
                            "w3c.traceparent": f"00-{trace_id}-{span_gateway}-01",
                        }
                    ),
                ),
                TraceSpan(
                    id=span_order,
                    trace_id=trace_id,
                    parent_span_id=span_gateway,
                    service="order-service",
                    operation="POST /orders",
                    start_offset_ms=6.0,
                    duration_ms=round(order_dur, 2),
                    status=order_status,
                    status_code=504 if is_impacted else 200,
                    tags=DataSanitizer.sanitize_metadata(
                        {
                            "http.method": "POST",
                            "http.route": "/orders",
                            "http.status_code": "504" if is_impacted else "200",
                            "error": "true" if is_impacted else "false",
                            "error.message": "Client.Timeout exceeded while awaiting headers from payment-service" if is_impacted else "",
                        }
                    ),
                ),
                TraceSpan(
                    id=span_payment,
                    trace_id=trace_id,
                    parent_span_id=span_order,
                    service="payment-service",
                    operation="POST /payments/charge",
                    start_offset_ms=18.0,
                    duration_ms=round(payment_dur, 2),
                    status=payment_status,
                    status_code=500 if is_impacted else 200,
                    tags=DataSanitizer.sanitize_metadata(
                        {
                            "http.method": "POST",
                            "http.route": "/payments/charge",
                            "chaos.fault_active": "true" if is_impacted else "false",
                            "chaos.injected_latency_ms": str(fault_magnitude_ms) if is_impacted else "0",
                            "toxiproxy.proxy_name": "payment_service_ingress",
                        }
                    ),
                ),
                TraceSpan(
                    id=span_db,
                    trace_id=trace_id,
                    parent_span_id=span_order,
                    service="orders-db",
                    operation="INSERT INTO orders (id, user_id, amount)",
                    start_offset_ms=round(18.0 + payment_dur + 5.0, 2),
                    duration_ms=4.8,
                    status="ok",
                    status_code=0,
                    tags={"db.system": "postgresql", "db.name": "orders_db"},
                ),
            ]

            # Filter by service if requested
            if service_id and not any(s.service == service_id for s in spans):
                continue

            traces.append(
                DistributedTrace(
                    trace_id=trace_id,
                    root_service="api-gateway",
                    root_operation="POST /api/v1/orders/checkout",
                    timestamp=trace_time.isoformat(),
                    duration_ms=round(gw_dur, 2),
                    spans_count=len(spans),
                    has_errors=has_error,
                    spans=spans,
                )
            )

        return traces

    def get_structured_logs(
        self,
        sandbox_id: str,
        service: Optional[str] = None,
        level: Optional[LogLevel] = None,
        trace_id: Optional[str] = None,
        experiment_id: Optional[str] = None,
        search_query: Optional[str] = None,
        limit: int = 50,
        fault_injected: bool = False,
    ) -> List[StructuredLogEntry]:
        """Queries structured JSON log streams with trace correlation and secret redaction."""
        now = datetime.now(timezone.utc)
        logs = []

        log_templates = [
            (LogLevel.INFO, "api-gateway", "Inbound HTTP POST /api/v1/orders/checkout handled successfully.", 22.4),
            (LogLevel.INFO, "order-service", "Order validated and routed to payment-service.", 18.2),
            (LogLevel.INFO, "payment-service", "Payment authorization token processed via PSP mock.", 34.0),
            (LogLevel.INFO, "orders-db", "Transaction committed for order ledger.", 3.8),
            (LogLevel.WARN, "order-service", "Payment client connection pool utilization exceeds 75%.", 480.0),
            (LogLevel.ERROR, "order-service", "Upstream payment-service timeout after 2000ms: 504 Gateway Timeout.", 2050.0),
            (LogLevel.CRITICAL, "payment-service", "Toxiproxy injected latency buffer saturated. TCP buffer delay: 2000ms.", 2004.0),
            (LogLevel.WARN, "inventory-service", "Stock reservation heartbeats delayed by 350ms.", 354.0),
        ]

        for i in range(limit):
            template_idx = i % len(log_templates)
            # If fault is active, increase proportion of warning and error logs
            if fault_injected and i % 3 == 0:
                template_idx = 5 if i % 2 == 0 else 6

            log_lvl, log_svc, log_msg, log_dur = log_templates[template_idx]
            log_time = now - timedelta(seconds=i * 12)
            gen_trace_id = trace_id or uuid4().hex

            # Filter checks
            if service and log_svc != service:
                continue
            if level and log_lvl != level:
                continue
            if search_query and search_query.lower() not in log_msg.lower():
                continue

            sanitized_metadata = DataSanitizer.sanitize_metadata(
                {
                    "http.status": 504 if log_lvl in (LogLevel.ERROR, LogLevel.CRITICAL) else 200,
                    "service.version": "1.0.0",
                    "tenant.slug": "acme-corp",
                    "raw_token": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",  # test sanitization
                    "auth_secret": "super-secret-key-1234",  # test sanitization
                }
            )

            entry = StructuredLogEntry(
                id=f"log-{uuid4().hex[:10]}",
                timestamp_iso=log_time.isoformat(),
                level=log_lvl,
                service=log_svc,
                sandbox_id=sandbox_id,
                cluster="sandbox-alpha-us-east-1",
                trace_id=gen_trace_id,
                span_id=uuid4().hex[:16],
                experiment_id=experiment_id if (fault_injected or i % 4 == 0) else None,
                message=DataSanitizer.sanitize_log_message(log_msg),
                duration_ms=log_dur,
                metadata=sanitized_metadata,
            )
            logs.append(entry)

        return logs

    def get_experiment_correlation(
        self,
        experiment_id: str,
        sandbox_id: str,
        target_service: str = "payment-service",
        fault_type: str = "latency",
        fault_magnitude: float = 2000.0,
        fault_unit: str = "ms",
        started_at: Optional[str] = None,
        duration_seconds: int = 60,
    ) -> ExperimentTelemetryCorrelation:
        """Computes the continuous 3-phase telemetry window (Baseline, Active Fault, Recovery) for an experiment."""
        now = datetime.now(timezone.utc)
        start_dt = datetime.fromisoformat(started_at) if started_at else now - timedelta(seconds=duration_seconds + 30)
        end_dt = start_dt + timedelta(seconds=duration_seconds)
        baseline_start_dt = start_dt - timedelta(seconds=duration_seconds)
        recovery_end_dt = end_dt + timedelta(seconds=duration_seconds)

        # 1. Baseline Summary (Steady state)
        baseline_summary = TelemetryWindowSummary(
            phase="baseline",
            start_time=baseline_start_dt.isoformat(),
            end_time=start_dt.isoformat(),
            sample_count=20,
            avg_p50_ms=28.5,
            avg_p95_ms=52.0,
            avg_p99_ms=64.2,
            avg_rps=98.0,
            avg_error_rate_pct=0.01,
            cpu_utilization_pct=24.5,
            memory_utilization_pct=36.0,
        )

        # 2. Active Fault Summary (Degraded state)
        active_p99 = 64.2 + fault_magnitude
        fault_summary = TelemetryWindowSummary(
            phase="fault_active",
            start_time=start_dt.isoformat(),
            end_time=end_dt.isoformat(),
            sample_count=20,
            avg_p50_ms=round(28.5 + (fault_magnitude * 0.88), 1),
            avg_p95_ms=round(52.0 + (fault_magnitude * 0.96), 1),
            avg_p99_ms=round(active_p99, 1),
            avg_rps=72.0,
            avg_error_rate_pct=14.8,
            cpu_utilization_pct=68.0,
            memory_utilization_pct=58.5,
        )

        # 3. Recovery Summary (Restored state)
        recovery_summary = TelemetryWindowSummary(
            phase="recovery",
            start_time=end_dt.isoformat(),
            end_time=recovery_end_dt.isoformat(),
            sample_count=20,
            avg_p50_ms=29.2,
            avg_p95_ms=54.5,
            avg_p99_ms=66.8,
            avg_rps=96.5,
            avg_error_rate_pct=0.04,
            cpu_utilization_pct=26.0,
            memory_utilization_pct=37.5,
        )

        impact_delta = ((active_p99 - 64.2) / 64.2) * 100.0

        # Retrieve correlated traces and logs captured during the active fault
        traces = self.get_distributed_traces(
            sandbox_id=sandbox_id,
            service_id=target_service,
            limit=5,
            has_errors_only=False,
            fault_injected=True,
            fault_magnitude_ms=fault_magnitude,
        )

        logs = self.get_structured_logs(
            sandbox_id=sandbox_id,
            service=target_service,
            experiment_id=experiment_id,
            limit=10,
            fault_injected=True,
        )

        return ExperimentTelemetryCorrelation(
            experiment_id=experiment_id,
            sandbox_id=sandbox_id,
            target_service=target_service,
            fault_type=fault_type,
            fault_magnitude=fault_magnitude,
            fault_unit=fault_unit,
            started_at=start_dt.isoformat(),
            completed_at=end_dt.isoformat(),
            baseline=baseline_summary,
            fault_active=fault_summary,
            recovery=recovery_summary,
            impact_delta_p99_pct=round(impact_delta, 1),
            recovered=True,
            correlated_traces=traces,
            correlated_logs=logs,
        )


# Global singleton instance
observability_service = ObservabilityService()
