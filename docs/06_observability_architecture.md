# ChaosEngine AI — Observability & Telemetry Architecture (Milestone M6)

## 1. Executive Summary

Milestone M6 establishes the real-time observability pipeline for ChaosEngine AI. Designed for multi-tenant microservice sandboxes undergoing active chaos fault injection, the architecture decouples tenant workloads from the centralized telemetry ingestion and storage tiers. Every microservice exports metrics, distributed traces (W3C Trace Context), and structured JSON logs via OpenTelemetry SDKs to a dedicated OpenTelemetry Collector, which fans out to Prometheus, Jaeger, and Loki.

---

## 2. Telemetry Pipeline Architecture

```mermaid
flowchart TD
    subgraph Sandbox [Tenant Kubernetes Sandbox: sandbox-tenant-uuid]
        subgraph Workload [Pod: order-service]
            App[Application Container \n OpenTelemetry SDK]
            Toxi[Toxiproxy Chaos Sidecar \n Port 8080 / Mgmt 8474]
        end
        App -.->|Egress Port 4317 OTLP gRPC| OTelCol
        Toxi -.->|Scraped on Port 8474| Prom
    end

    subgraph ControlPlane [Control Plane Namespace: chaos-control-plane]
        OTelCol[OpenTelemetry Collector Contrib \n Port 4317 gRPC / 4318 HTTP]
        Prom[(Prometheus TSDB \n Port 9090)]
        Jaeger[(Jaeger Tracing \n Port 16686 / 4317)]
        Loki[(Grafana Loki \n Port 3100)]
        FastAPI[FastAPI Backend /api/v1/telemetry]
    end

    subgraph ObservabilityCenter [Frontend UI (Obsidian Telemetry)]
        UI[Next.js / React 19 Dashboard]
    end

    OTelCol -->|Metrics Exporter 8889| Prom
    OTelCol -->|OTLP Traces| Jaeger
    OTelCol -->|Push API /loki/api/v1/push| Loki

    FastAPI -->|PromQL Range Queries| Prom
    FastAPI -->|gRPC Trace Queries| Jaeger
    FastAPI -->|LogQL Stream Queries| Loki

    UI -->|REST /api/v1/telemetry/*| FastAPI
```

---

## 3. Data Flow Specification

### 3.1 Metrics Flow (Prometheus)
1. **Application Runtime Metrics**: Microservices emit OTLP metric payloads (HTTP request count, active requests, latencies, error codes, CPU/memory gauges) to the OTel Collector via gRPC port 4317.
2. **Sidecar Metrics**: Prometheus scrapes Toxiproxy pods directly on port 8474 every 5 seconds to capture active toxic configurations and connection failures.
3. **Scrape & Processing**: The OTel Collector processes metrics through `memory_limiter`, `attributes`, and `batch` processors before exposing Prometheus metrics on port 8889.
4. **Quantile Calculation**: The backend executes PromQL range queries:
   - $P99$: `histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[1m])) by (le, service))`
   - $RPS$: `sum(rate(http_requests_total[1m])) by (service)`
   - $5xx$: `sum(rate(http_requests_total{status=~"5.."}[1m])) / sum(rate(http_requests_total[1m])) * 100`

### 3.2 Distributed Tracing Flow (Jaeger)
1. **Trace Propagation**: Calls between services carry the W3C Trace Context HTTP header:
   ```text
   traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
   ```
2. **Ingress Traversal**: Inbound requests pass through the API Gateway, which generates the root span.
3. **Egress Forwarding**: HTTP clients inject parent span IDs before dispatching downstream calls to `order-service`, `payment-service`, and database connectors.
4. **Export**: Spans are pushed asynchronously over OTLP gRPC to the collector, which routes them to Jaeger.

### 3.3 Structured Logging Flow (Loki)
1. **JSON Stream Emission**: Services log single-line JSON records tagged with `tenant_id`, `sandbox_id`, `service`, `trace_id`, and `span_id`.
2. **Secret Scrubbing**: The OTel Collector and backend `DataSanitizer` scrub passwords, authorization headers, and secret keys before indexing.
3. **Indexing**: Loki indexes streams by low-cardinality labels (`tenant_id`, `sandbox_id`, `service_name`, `level`), storing messages in compressed chunk files.

---

## 4. Multi-Tenant Isolation & Security Invariants

1. **NetworkPolicy Egress Confinement**:
   Sandbox workloads cannot reach control-plane databases (`postgres`), internal APIs, or arbitrary internet IPs. Egress is whitelisted strictly to:
   - `CoreDNS` (`kube-system:53`)
   - `OTel Collector` (`chaos-control-plane:4317`)
2. **Query Tenant Scoping**:
   Every query to `/api/v1/telemetry/*` requires a validated JWT and `X-Tenant-ID` header. The backend validates that the requested `sandbox_id` belongs to the requesting tenant before querying TSDB backends.
3. **No Direct Administrative Exposure**:
   Prometheus, Loki, and Jaeger web interfaces and administrative APIs are isolated within `chaos-control-plane` and not exposed to the public internet or sandbox networks. All access is proxied and filtered through the backend REST API.
4. **High-Cardinality Guardrails**:
   Dimensions containing user identifiers, raw tokens, or arbitrary URLs are stripped by `DataSanitizer` to prevent cardinality explosion in Prometheus TSDB memory tables.

---

## 5. Storage Retention & Resource Limits

| Component | Storage Engine | Retention Window | Max Memory Limit | CPU Request / Limit |
|---|---|---|---|---|
| **Prometheus** | TSDB Block Storage | 7 Days (`retention.time=7d`) | 2 GiB | 200m / 1000m |
| **Jaeger** | In-Memory / Badger | 7 Days | 1 GiB | 200m / 1000m |
| **Loki** | TSDB Index + Chunks | 7 Days (168 Hours) | 1 GiB | 200m / 1000m |
| **OTel Collector** | Memory Limiter Queue | Real-time Stream Buffer | 1 GiB (75% Soft Limit) | 200m / 1000m |
