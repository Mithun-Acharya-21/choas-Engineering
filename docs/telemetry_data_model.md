# ChaosEngine AI — Telemetry Data Model & Metric Schema (Milestone M6)

## 1. Domain Entities & Schemas

This document defines the data structures used by the ChaosEngine AI Observability pipeline across ingestion, storage, querying, and experiment correlation.

---

## 2. Metric Series Models

### `MetricPoint`
Represents a discrete time bucket of aggregated telemetry metrics for a service:

```typescript
interface MetricPoint {
  timestamp: string;             // ISO 8601 UTC timestamp
  p50: number;                   // 50th percentile latency (ms)
  p95: number;                   // 95th percentile latency (ms)
  p99: number;                   // 99th percentile latency (ms)
  baselineP99: number;           // Steady-state reference P99 latency (ms)
  rps: number;                   // Inbound requests per second
  errorRate: number;             // Percentage of 5xx HTTP responses (0.0 - 100.0)
  cpuUtilizationPct?: number;    // Container CPU utilization percentage (0.0 - 100.0)
  memoryUtilizationPct?: number; // Container memory utilization percentage (0.0 - 100.0)
  activeRequests?: number;       // Number of concurrent in-flight requests
  faultActive: boolean;          // Whether chaos fault injection was active at this timestamp
}
```

### Python Pydantic Model (`models.py`)

```python
class MetricPoint(BaseModel):
    timestamp: str
    p50: float
    p95: float
    p99: float
    baseline_p99: float
    rps: float
    error_rate: float
    cpu_utilization_pct: float = 25.0
    memory_utilization_pct: float = 35.0
    active_requests: int = 10
    fault_active: bool = False
```

---

## 3. Distributed Tracing Models (W3C Trace Context)

### `TraceSpan`
Represents a discrete execution unit in a distributed trace hierarchy:

```typescript
interface TraceSpan {
  id: string;                     // 64-bit hex span ID (e.g., '00f067aa0ba902b7')
  traceId?: string;               // 128-bit hex trace ID (e.g., '4bf92f3577b34da6a3ce929d0e0e4736')
  parentSpanId?: string | null;   // Parent span ID (null for root span)
  service: string;                // Service emitting the span (e.g., 'order-service')
  operation: string;              // HTTP route or DB query (e.g., 'POST /orders')
  startOffsetMs: number;          // Relative start offset from trace root (ms)
  durationMs: number;             // Operation duration (ms)
  status: 'ok' | 'degraded' | 'error';
  statusCode?: number;            // HTTP or RPC status code (e.g., 200, 504)
  tags?: Record<string, string>;  // Sanitized attributes (e.g., w3c.traceparent, db.system)
}
```

### `DistributedTrace`
Represents the complete end-to-end trace graph across microservices:

```typescript
interface DistributedTrace {
  traceId: string;
  rootService: string;
  rootOperation: string;
  timestamp: string;
  durationMs: number;
  spansCount: number;
  hasErrors: boolean;
  spans: TraceSpan[];
}
```

---

## 4. Structured Logging Models

### `StructuredLogEntry`
Represents a single JSON log record emitted by a service and indexed in Loki:

```typescript
interface LogEntry {
  id: string;                                   // Unique log UUID
  timestampIso: string;                         // ISO 8601 UTC timestamp
  level: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  service: string;                              // Emitting service
  sandboxId?: string;                           // Enclosing sandbox UUID
  cluster: string;                              // Sandbox cluster ID
  traceId: string;                              // Correlated W3C trace ID
  spanId?: string;                              // Correlated span ID
  experimentId?: string;                        // Correlated active experiment ID
  durationMs: number;                           // Request duration (if applicable)
  message: string;                              // Sanitized log text
  metadata: Record<string, string | number>;    // Secret-scrubbed parameters
  spans: TraceSpan[];                           // Associated trace spans
}
```

---

## 5. Experiment 3-Phase Correlation Models

### `TelemetryWindowSummary`
Summarizes metrics across one phase of a chaos experiment:

```typescript
interface TelemetryWindowSummary {
  phase: 'baseline' | 'fault_active' | 'recovery';
  startTime: string;
  endTime: string;
  sampleCount: number;
  avgP50Ms: number;
  avgP95Ms: number;
  avgP99Ms: number;
  avgRps: number;
  avgErrorRatePct: number;
  cpuUtilizationPct: number;
  memoryUtilizationPct: number;
}
```

### `ExperimentTelemetryCorrelation`
Complete time-correlated telemetry payload binding an experiment execution to its baseline, fault, and recovery windows:

```typescript
interface ExperimentTelemetryCorrelation {
  experimentId: string;
  sandboxId: string;
  targetService: string;
  faultType: string;
  faultMagnitude: number;
  faultUnit: string;
  startedAt: string;
  completedAt?: string;
  baseline: TelemetryWindowSummary;
  faultActive: TelemetryWindowSummary;
  recovery: TelemetryWindowSummary;
  impactDeltaP99Pct: number;
  recovered: boolean;
  correlatedTraces: DistributedTrace[];
  correlatedLogs: LogEntry[];
}
```

---

## 6. Prohibited High-Cardinality Dimensions

To protect Prometheus TSDB memory tables and Loki stream indexes, the following dimensions are strictly blocked from metric queries and label definitions:

| Key | Reason for Prohibition | Mitigation / Approved Alternative |
|---|---|---|
| `user_id` / `account_id` | Unbounded growth per tenant user base | Track in structured log metadata or span tags |
| `request_id` / `transaction_id` | Unique per HTTP call | Track in OpenTelemetry `trace_id` |
| `raw_url` / path with IDs | e.g., `/orders/550e8400-...` | Parameterize to `/orders/{id}` using `http.route` |
| `email` / PII | Privacy and cardinality violation | Strip in `DataSanitizer` |
| `jwt` / `auth_token` | Security credential and high-cardinality | Strip in `DataSanitizer` |
