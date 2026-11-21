# ChaosEngine AI — Observability Local Setup & Troubleshooting Guide (Milestone M6)

## 1. Local Development Stack Options

Developers and operators can run the ChaosEngine AI Observability pipeline locally via **Docker Compose** or directly inside a **Kind/Minikube Kubernetes cluster**.

---

## 2. Option A: Docker Compose Setup

Run the telemetry stack using the included `docker-compose.observability.yml`:

```bash
# 1. Start OpenTelemetry Collector, Prometheus, Jaeger, Loki, and Grafana
docker compose -f docker-compose.observability.yml up -d

# 2. Verify container health
docker compose -f docker-compose.observability.yml ps
```

### Exposed Service Endpoints:

| Service | Port | Endpoint URL | Purpose |
|---|---|---|---|
| **OTel Collector (gRPC)** | `4317` | `localhost:4317` | Ingestion of OTLP traces, metrics, logs |
| **OTel Collector (HTTP)** | `4318` | `localhost:4318` | HTTP/Protobuf OTLP ingestion |
| **Prometheus Exporter** | `8889` | `http://localhost:8889/metrics` | Collector metrics scraped by Prometheus |
| **Prometheus Web UI** | `9090` | `http://localhost:9090` | PromQL debugging & TSDB query interface |
| **Jaeger Web UI** | `16686` | `http://localhost:16686` | Trace waterfall search & visualization |
| **Loki Log Ingestion** | `3100` | `http://localhost:3100` | LogQL structured log stream storage |
| **Grafana Dashboard** | `3001` | `http://localhost:3001` (admin/admin) | Centralized telemetry visualization |

---

## 3. Option B: Kubernetes Cluster Setup (Kind / Minikube)

Deploy the observability pipeline into the control plane namespace (`chaos-control-plane`):

```bash
# 1. Ensure control plane namespace exists
kubectl create namespace chaos-control-plane --dry-run=client -o yaml | kubectl apply -f -

# 2. Apply ConfigMaps
kubectl apply -f k8s/observability/otel-collector-config.yaml
kubectl apply -f k8s/observability/prometheus.yaml
kubectl apply -f k8s/observability/loki-config.yaml

# 3. Apply Deployments and Services
kubectl apply -f k8s/observability/telemetry-pipeline.yaml

# 4. Verify deployment rollout
kubectl rollout status deployment/otel-collector -n chaos-control-plane
kubectl rollout status deployment/jaeger -n chaos-control-plane
kubectl rollout status deployment/loki -n chaos-control-plane
```

---

## 4. End-to-End Ingestion Verification

### 1. Verify Metrics Scrapes in Prometheus
Query Prometheus via curl or web UI at `http://localhost:9090`:
```bash
curl "http://localhost:9090/api/v1/query?query=sum(rate(chaosengine_http_requests_total[1m]))"
```

### 2. Verify Trace Ingestion in Jaeger
Open `http://localhost:16686` and select `service: api-gateway` to confirm traces are propagating with W3C spans.

### 3. Verify Log Streams in Loki
```bash
curl -G -s "http://localhost:3100/loki/api/v1/query" --data-urlencode 'query={service_name="payment-service"}' | jq .
```

---

## 5. Troubleshooting & Diagnostics

### Issue 1: "Workload pods cannot reach OTel Collector on port 4317"
- **Cause**: Kubernetes `NetworkPolicy` inside tenant sandbox is blocking egress.
- **Resolution**: Verify that the sandbox namespace contains the `default-deny-isolate` NetworkPolicy with explicit egress whitelist for `chaos-control-plane` port 4317:
  ```bash
  kubectl get networkpolicy default-deny-isolate -n <sandbox-namespace> -o yaml
  ```

### Issue 2: "High-cardinality label rejection (HTTP 400)"
- **Cause**: The client query included prohibited dimensions like `user_id`, `request_id`, or `token`.
- **Resolution**: Use standard low-cardinality dimensions: `service_id`, `status_code`, `method`, `protocol`. Use structured logs or OpenTelemetry trace spans for fine-grained transaction IDs.

### Issue 3: "Traces appear disconnected with separate root spans"
- **Cause**: Microservice HTTP client is omitting the W3C `traceparent` header when calling downstream services.
- **Resolution**: Ensure microservice SDK uses standard propagators:
  `OTEL_PROPAGATORS="tracecontext,baggage"`.
