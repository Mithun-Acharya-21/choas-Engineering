"""Domain models for ChaosEngine AI Telemetry & Observability Pipeline (Milestone M6)."""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class TimeRange(str, Enum):
    RANGE_15M = "15m"
    RANGE_1H = "1h"
    RANGE_6H = "6h"
    RANGE_24H = "24h"


class LogLevel(str, Enum):
    INFO = "INFO"
    WARN = "WARN"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class MetricPoint(BaseModel):
    timestamp: str = Field(..., description="ISO 8601 formatted timestamp")
    p50: float = Field(..., description="50th percentile latency in milliseconds")
    p95: float = Field(..., description="95th percentile latency in milliseconds")
    p99: float = Field(..., description="99th percentile latency in milliseconds")
    baseline_p99: float = Field(..., description="Calculated steady-state baseline P99 latency in ms")
    rps: float = Field(..., description="Requests per second")
    error_rate: float = Field(..., description="Percentage of requests returning 5xx status codes (0.0 - 100.0)")
    cpu_utilization_pct: float = Field(default=25.0, description="CPU usage as percentage of limit (0.0 - 100.0)")
    memory_utilization_pct: float = Field(default=35.0, description="Memory usage as percentage of limit (0.0 - 100.0)")
    active_requests: int = Field(default=10, description="In-flight HTTP requests")
    fault_active: bool = Field(default=False, description="Whether a chaos fault is actively injected at this timestamp")


class TimeSeriesMetric(BaseModel):
    service_id: str
    service_name: str
    sandbox_id: str
    points: List[MetricPoint] = Field(default_factory=list)


class TraceSpan(BaseModel):
    id: str = Field(..., description="W3C 64-bit span identifier")
    trace_id: str = Field(..., description="W3C 128-bit trace identifier")
    parent_span_id: Optional[str] = Field(default=None, description="Parent span identifier or None for root span")
    service: str = Field(..., description="Service emitting the span")
    operation: str = Field(..., description="HTTP method/route or database call, e.g. 'POST /api/v1/orders'")
    start_offset_ms: float = Field(default=0.0, description="Relative offset from trace start in milliseconds")
    duration_ms: float = Field(..., description="Duration of this operation in milliseconds")
    status: str = Field(default="ok", description="'ok', 'degraded', or 'error'")
    status_code: Optional[int] = Field(default=200, description="HTTP or RPC status code")
    tags: Dict[str, str] = Field(default_factory=dict, description="Sanitized OpenTelemetry span attributes")


class DistributedTrace(BaseModel):
    trace_id: str = Field(..., description="W3C trace ID")
    root_service: str = Field(..., description="Perimeter gateway service receiving client request")
    root_operation: str = Field(..., description="Root HTTP endpoint")
    timestamp: str = Field(..., description="Trace origin timestamp ISO 8601")
    duration_ms: float = Field(..., description="Total end-to-end trace latency in milliseconds")
    spans_count: int = Field(..., description="Number of spans in this trace graph")
    has_errors: bool = Field(default=False, description="Whether any child span recorded an error")
    spans: List[TraceSpan] = Field(default_factory=list, description="Ordered waterfall of child spans")


class StructuredLogEntry(BaseModel):
    id: str = Field(..., description="Unique log event identifier")
    timestamp_iso: str = Field(..., description="ISO 8601 UTC event timestamp")
    level: LogLevel = Field(default=LogLevel.INFO)
    service: str = Field(..., description="Origin service name")
    sandbox_id: str = Field(..., description="Target sandbox identifier")
    cluster: str = Field(default="sandbox-alpha-us-east-1")
    trace_id: Optional[str] = Field(default=None, description="Correlated W3C trace ID")
    span_id: Optional[str] = Field(default=None, description="Correlated span ID")
    experiment_id: Optional[str] = Field(default=None, description="Correlated active experiment ID if injected")
    message: str = Field(..., description="Log message text")
    duration_ms: Optional[float] = Field(default=None, description="Associated request duration")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Structured log parameters (secret sanitized)")
    spans: List[TraceSpan] = Field(default_factory=list, description="Associated trace spans if correlated")


class ServiceHealthStatus(BaseModel):
    service_id: str
    name: str
    namespace: str
    cluster: str
    status: str = Field(default="healthy", description="'healthy', 'degraded', or 'critical'")
    replicas_desired: int = 1
    replicas_ready: int = 1
    restarts_total: int = 0
    p99_ms: float = 45.0
    rps: float = 120.0
    error_rate_pct: float = 0.0
    slo_budget_remaining_pct: float = 100.0
    toxiproxy_active: bool = True


class TelemetryWindowSummary(BaseModel):
    phase: str = Field(..., description="'baseline', 'fault_active', or 'recovery'")
    start_time: str
    end_time: str
    sample_count: int
    avg_p50_ms: float
    avg_p95_ms: float
    avg_p99_ms: float
    avg_rps: float
    avg_error_rate_pct: float
    cpu_utilization_pct: float
    memory_utilization_pct: float


class ExperimentTelemetryCorrelation(BaseModel):
    experiment_id: str
    sandbox_id: str
    target_service: str
    fault_type: str
    fault_magnitude: float
    fault_unit: str
    started_at: str
    completed_at: Optional[str] = None
    baseline: TelemetryWindowSummary
    fault_active: TelemetryWindowSummary
    recovery: TelemetryWindowSummary
    impact_delta_p99_pct: float = Field(..., description="Percentage latency increase in fault window vs baseline")
    recovered: bool = Field(default=True, description="Whether metrics returned to steady-state baseline in recovery window")
    correlated_traces: List[DistributedTrace] = Field(default_factory=list)
    correlated_logs: List[StructuredLogEntry] = Field(default_factory=list)
