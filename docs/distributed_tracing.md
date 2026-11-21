# ChaosEngine AI — OpenTelemetry Distributed Tracing (Milestone M6)

## 1. Overview & W3C Trace Context Standards

Distributed tracing in ChaosEngine AI tracks cross-service requests across sandbox microservices during chaos engineering experiments. It provides sub-millisecond latency attribution, revealing exactly which service, database call, or proxy introduced degraded performance.

### W3C Trace Context Header (`traceparent`)

Every inter-service HTTP request carries the standard W3C `traceparent` header:

```text
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
              │  └───────────────┬──────────────┘ └───────┬──────┘ └─┬┘
           Version          Trace ID                  Span ID      Flags
```

- **Version**: `00` (Current W3C specification).
- **Trace ID**: 32-character lowercase hexadecimal string (128-bit UUID) globally identifying the distributed transaction.
- **Parent Span ID**: 16-character hexadecimal string (64-bit) identifying the immediate caller.
- **Trace Flags**: `01` indicating the trace was sampled.

---

## 2. End-to-End Request Path & Span Waterfall

For a typical e-commerce transaction:

```
[Client]
    │
    ▼
1. api-gateway (POST /api/v1/orders/checkout) ─── [Root Span: 00f067aa0ba902b7]
    │
    ▼ (HTTP 8080 via Toxiproxy)
2. order-service (POST /orders) ────────────────── [Child Span: 5fb397be34d23b0f]
    │
    ├────────────────────────────────────────┐
    ▼ (HTTP 8080 via Toxiproxy)              ▼ (TCP 5432)
3. payment-service (POST /payments/charge)  4. orders-db (INSERT INTO orders)
   [Child Span: 93564f3c20c3577e]              [Child Span: 71c82e6669911e99]
    │
    ▼ (HTTPS 443)
5. stripe-psp (POST /v1/charges)
   [Child Span: 82a19b4412ef8801]
```

### Span Waterfall Representation (Steady State):

```text
[api-gateway]       |████████████████████████████████████| 48ms (200 OK)
  [order-service]     |██████████████████████████████|   42ms (200 OK)
    [payment-service]   |████████████████████|           32ms (200 OK)
      [stripe-psp]        |██████████████|               24ms (200 OK)
    [orders-db]                                |███|      4ms (0 OK)
```

---

## 3. Latency Attribution Under Chaos Injection

When a 2000ms latency fault is injected on `payment-service`:
1. Ingress traffic to `payment-service` enters through its injected Toxiproxy sidecar port (`8080`).
2. The proxy delays TCP stream delivery to the application container (`port 8081`) by 2000ms.
3. The OpenTelemetry span for `payment-service` expands to 2042ms, marked as `degraded` or `error`.
4. Downstream, the `order-service` HTTP client blocks on socket read. If its client timeout is 2000ms, it aborts with an HTTP 504 Gateway Timeout.
5. In the trace waterfall, the self-time for `payment-service` constitutes **> 95%** of the entire trace duration, proving to operators and RCA engines that `payment-service` was the delay origin:

```text
[api-gateway]       |██████████████████████████████████████████████████████| 2115ms (504 Error)
  [order-service]     |██████████████████████████████████████████████████|   2095ms (504 Error)
    [payment-service]   |██████████████████████████████████████████████|     2042ms (200 Degraded)
```

---

## 4. Instrumentation Guidelines

### Go / Python / Node.js Microservice SDK Setup:
Microservices inside sandboxes receive standard OpenTelemetry environment variables injected by the platform:

```yaml
env:
  - name: OTEL_SERVICE_NAME
    value: "payment-service"
  - name: OTEL_EXPORTER_OTLP_ENDPOINT
    value: "http://otel-collector.chaos-control-plane.svc.cluster.local:4317"
  - name: OTEL_EXPORTER_OTLP_PROTOCOL
    value: "grpc"
  - name: OTEL_PROPAGATORS
    value: "tracecontext,baggage"
  - name: OTEL_RESOURCE_ATTRIBUTES
    value: "chaosengine.tenant_id=c1f7b0f6-...,chaosengine.sandbox_id=3fa85f64-..."
```
