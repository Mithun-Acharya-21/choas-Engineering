# ChaosEngine AI — Service Topology Data Schema & Kubernetes Mapping Specification

## 1. Schema Overview

This document specifies the exact JSON and Pydantic data schemas representing service topologies in ChaosEngine AI (Milestone M4). Topologies define microservice graphs, container specifications, resource allocations, environment configurations, and network dependencies.

---

## 2. Pydantic Domain Schema (`backend/app/domains/topology/models.py`)

### Enums

```python
from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

class NodeType(str, Enum):
    API_GATEWAY = "api_gateway"
    APP_SERVICE = "app_service"
    POSTGRES = "postgres"
    REDIS = "redis"
    EXTERNAL = "external"

class ProtocolType(str, Enum):
    HTTP = "HTTP"
    GRPC = "gRPC"
    AMQP = "AMQP"
    TCP = "TCP"

class DependencyType(str, Enum):
    SYNCHRONOUS = "synchronous"
    ASYNCHRONOUS = "asynchronous"
```

### Sub-Models

```python
class ResourceLimits(BaseModel):
    cpu_request: str = "100m"
    cpu_limit: str = "500m"
    memory_request: str = "128Mi"
    memory_limit: str = "512Mi"

class HealthCheck(BaseModel):
    path: str = "/health"
    port: int = 8081
    initial_delay_seconds: int = 5
    period_seconds: int = 10

class NodePosition(BaseModel):
    x: float
    y: float

class TopologyNode(BaseModel):
    id: str = Field(..., description="RFC 1123 compliant unique identifier, e.g. 'order-service'")
    name: str = Field(..., description="Human-readable service title")
    node_type: NodeType
    image: str = Field(..., description="Approved container catalog image URI")
    container_port: int = Field(default=8081, ge=1)
    replicas: int = Field(default=1, ge=1, le=10)
    env_vars: Dict[str, str] = Field(default_factory=dict)
    resource_limits: ResourceLimits = Field(default_factory=ResourceLimits)
    health_check: Optional[HealthCheck] = None
    group_id: Optional[str] = None
    position: NodePosition = Field(default_factory=lambda: NodePosition(x=100.0, y=100.0))

class TopologyEdge(BaseModel):
    id: str = Field(..., description="Unique edge identifier")
    source: str = Field(..., description="Source node ID")
    target: str = Field(..., description="Target node ID")
    protocol: ProtocolType = ProtocolType.HTTP
    dependency_type: DependencyType = DependencyType.SYNCHRONOUS
    port: Optional[int] = Field(default=None, description="Target destination port")

class TopologyGroup(BaseModel):
    id: str
    name: str
    color: Optional[str] = None
```

### Root Records & Versioning

```python
class TopologyRecord(BaseModel):
    id: str = Field(..., description="Topology UUID")
    tenant_id: str
    project_id: str
    name: str
    version: int = Field(default=1, ge=1)
    nodes: List[TopologyNode] = Field(default_factory=list)
    edges: List[TopologyEdge] = Field(default_factory=list)
    groups: List[TopologyGroup] = Field(default_factory=list)
    created_at: str
    updated_at: str

class TopologyVersionRecord(BaseModel):
    id: str = Field(..., description="Snapshot UUID")
    topology_id: str
    version: int
    name: str
    nodes: List[TopologyNode]
    edges: List[TopologyEdge]
    groups: List[TopologyGroup]
    created_at: str
    created_by: str
```

### Validation & Deployment Responses

```python
class ValidationErrorDetail(BaseModel):
    code: str
    message: str
    node_id: Optional[str] = None
    edge_id: Optional[str] = None
    severity: str = "ERROR"  # "ERROR" or "WARNING"

class TopologyValidationResult(BaseModel):
    is_valid: bool
    errors: List[ValidationErrorDetail] = Field(default_factory=list)
    warnings: List[ValidationErrorDetail] = Field(default_factory=list)

class TopologyDeployResponse(BaseModel):
    status: str = "DEPLOYED"
    topology_id: str
    sandbox_id: str
    namespace: str
    workloads_deployed: int
    deployed_workloads: List[Dict[str, str]]
    timestamp: str
```

---

## 3. Kubernetes Manifest Translation Mapping Rules

When `TopologyService.deploy_topology_to_sandbox` processes a validated topology, each `TopologyNode` is transformed into Kubernetes API objects in accordance with the following rules:

### A. Deployment Manifest Specification (`apps/v1`)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: <node.id>
  namespace: <sandbox.k8s_namespace>
  labels:
    app.kubernetes.io/name: <node.id>
    app.kubernetes.io/component: <node.node_type>
    chaosengine.io/tenant: <sandbox.tenant_id>
    chaosengine.io/sandbox: <sandbox.id>
    chaosengine.io/topology-version: "<topology.version>"
spec:
  replicas: <node.replicas>
  selector:
    matchLabels:
      app: <node.id>
  template:
    metadata:
      labels:
        app: <node.id>
        chaosengine.io/sandbox: <sandbox.id>
    spec:
      serviceAccountName: unprivileged-sandbox-sa
      automountServiceAccountToken: false
      containers:
        # Container 1: Application Container
        - name: app
          image: <node.image>
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: <node.container_port>
              name: app-port
          resources:
            requests:
              cpu: <node.resource_limits.cpu_request>
              memory: <node.resource_limits.memory_request>
            limits:
              cpu: <node.resource_limits.cpu_limit>
              memory: <node.resource_limits.memory_limit>
          env:
            - name: PORT
              value: "<node.container_port>"
            # Scanned and sanitized key-values:
            - name: KEY
              value: "VALUE"
          livenessProbe:
            httpGet:
              path: <node.health_check.path>
              port: <node.container_port>
            initialDelaySeconds: <node.health_check.initial_delay_seconds>
            periodSeconds: <node.health_check.period_seconds>
          readinessProbe:
            httpGet:
              path: <node.health_check.path>
              port: <node.container_port>
            initialDelaySeconds: <node.health_check.initial_delay_seconds>
            periodSeconds: <node.health_check.period_seconds>
        
        # Container 2: Toxiproxy Chaos Sidecar
        - name: toxiproxy-sidecar
          image: ghcr.io/shopify/toxiproxy:2.9.0
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 8080
              name: proxy-ingress
            - containerPort: 8474
              name: toxiproxy-api
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 200m
              memory: 128Mi
          args:
            - "-host=0.0.0.0"
            - "-config=/etc/toxiproxy/toxiproxy.json"
```

### B. Service Manifest Specification (`v1`)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: <node.id>
  namespace: <sandbox.k8s_namespace>
  labels:
    app.kubernetes.io/name: <node.id>
spec:
  type: ClusterIP
  selector:
    app: <node.id>
  ports:
    - name: proxy-traffic
      port: 8080
      targetPort: 8080
    - name: direct-app
      port: <node.container_port>
      targetPort: <node.container_port>
    - name: toxiproxy-api
      port: 8474
      targetPort: 8474
```

---

## 4. Complete Example Topology JSON (E-Commerce Sample Mesh)

```json
{
  "id": "topo-microservices-default",
  "tenant_id": "c1f7b0f6-9304-4c57-897e-d309085ec617",
  "project_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "E-Commerce Core Microservices",
  "version": 1,
  "nodes": [
    {
      "id": "api-gateway",
      "name": "API Gateway",
      "node_type": "api_gateway",
      "image": "chaosengine/api-gateway:1.0.0",
      "container_port": 8081,
      "replicas": 2,
      "env_vars": {
        "ROUTE_ORDERS": "http://order-service:8080",
        "ROUTE_INVENTORY": "http://inventory-service:8080"
      },
      "resource_limits": {
        "cpu_request": "200m",
        "cpu_limit": "500m",
        "memory_request": "256Mi",
        "memory_limit": "512Mi"
      },
      "health_check": {
        "path": "/health",
        "port": 8081,
        "initial_delay_seconds": 5,
        "period_seconds": 10
      },
      "position": { "x": 100, "y": 250 }
    },
    {
      "id": "order-service",
      "name": "Order Service",
      "node_type": "app_service",
      "image": "chaosengine/order-service:1.0.0",
      "container_port": 8081,
      "replicas": 2,
      "env_vars": {
        "DB_HOST": "orders-db",
        "PAYMENT_SERVICE_URL": "http://payment-service:8080"
      },
      "resource_limits": {
        "cpu_request": "200m",
        "cpu_limit": "500m",
        "memory_request": "256Mi",
        "memory_limit": "512Mi"
      },
      "health_check": {
        "path": "/health",
        "port": 8081,
        "initial_delay_seconds": 5,
        "period_seconds": 10
      },
      "position": { "x": 400, "y": 150 }
    },
    {
      "id": "payment-service",
      "name": "Payment Service",
      "node_type": "app_service",
      "image": "chaosengine/payment-service:1.0.0",
      "container_port": 8081,
      "replicas": 1,
      "env_vars": {
        "PSP_ENDPOINT": "https://stripe-psp:443"
      },
      "resource_limits": {
        "cpu_request": "100m",
        "cpu_limit": "300m",
        "memory_request": "128Mi",
        "memory_limit": "256Mi"
      },
      "health_check": {
        "path": "/health",
        "port": 8081,
        "initial_delay_seconds": 5,
        "period_seconds": 10
      },
      "position": { "x": 700, "y": 150 }
    },
    {
      "id": "orders-db",
      "name": "Orders PostgreSQL",
      "node_type": "postgres",
      "image": "postgres:16-alpine",
      "container_port": 5432,
      "replicas": 1,
      "env_vars": {
        "POSTGRES_DB": "orders_db",
        "POSTGRES_USER": "chaos_admin"
      },
      "resource_limits": {
        "cpu_request": "250m",
        "cpu_limit": "1000m",
        "memory_request": "512Mi",
        "memory_limit": "1Gi"
      },
      "health_check": {
        "path": "/health",
        "port": 5432,
        "initial_delay_seconds": 10,
        "period_seconds": 15
      },
      "position": { "x": 400, "y": 380 }
    },
    {
      "id": "stripe-psp",
      "name": "Stripe PSP Gateway",
      "node_type": "external",
      "image": "chaosengine/external-mock:1.0.0",
      "container_port": 443,
      "replicas": 1,
      "env_vars": {},
      "resource_limits": {
        "cpu_request": "50m",
        "cpu_limit": "200m",
        "memory_request": "64Mi",
        "memory_limit": "128Mi"
      },
      "health_check": null,
      "position": { "x": 1000, "y": 150 }
    }
  ],
  "edges": [
    {
      "id": "edge-gateway-orders",
      "source": "api-gateway",
      "target": "order-service",
      "protocol": "HTTP",
      "dependency_type": "synchronous",
      "port": 8080
    },
    {
      "id": "edge-orders-payment",
      "source": "order-service",
      "target": "payment-service",
      "protocol": "HTTP",
      "dependency_type": "synchronous",
      "port": 8080
    },
    {
      "id": "edge-orders-db",
      "source": "order-service",
      "target": "orders-db",
      "protocol": "TCP",
      "dependency_type": "synchronous",
      "port": 5432
    },
    {
      "id": "edge-payment-stripe",
      "source": "payment-service",
      "target": "stripe-psp",
      "protocol": "HTTP",
      "dependency_type": "synchronous",
      "port": 443
    }
  ],
  "groups": [
    {
      "id": "group-order-domain",
      "name": "Order Management Domain",
      "color": "#6366f1"
    }
  ],
  "created_at": "2026-11-20T10:00:00Z",
  "updated_at": "2026-11-20T10:00:00Z"
}
```
