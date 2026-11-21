# REST API Specification (OpenAPI 3.1 Aligned)

## 1. Global Conventions & Standards

- **Base URL:** `/api/v1`
- **Protocol:** HTTPS (TLS 1.3)
- **Data Format:** `application/json` (UTF-8 encoding)
- **Authentication:** OAuth2 Password Bearer flow. Client passes `Authorization: Bearer <access_token>` header on authenticated endpoints.
- **Tenant Scope:** The active tenant is extracted from the user's JWT claims (`tenant_id`) or passed via optional header `X-Tenant-ID: <uuid>` when a user belongs to multiple tenants.
- **Asynchronous Operations:** Long-running operations (e.g., sandbox provisioning, experiment execution) respond with `202 Accepted` and a `Location` header or payload referencing the trackable task/run resource.
- **Error Format (RFC 7807 Problem Details):**
  ```json
  {
    "type": "https://api.chaosengine.io/errors/RESOURCE_NOT_FOUND",
    "title": "Resource Not Found",
    "status": 404,
    "detail": "Sandbox with ID '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' was not found in active tenant.",
    "instance": "/api/v1/sandboxes/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "code": "ERR_SANDBOX_NOT_FOUND",
    "timestamp": "2026-11-18T12:00:00Z"
  }
  ```

---

## 2. Authentication Endpoints

### 2.1 Register User
- **Method & URL:** `POST /api/v1/auth/register`
- **Purpose:** Registers a new user account, creates their default personal tenant, and issues initial credentials.
- **Authentication:** None (Public)
- **Authorization:** None
- **Request Schema:**
  ```json
  {
    "email": "sre.lead@acme.com",
    "password": "SecurePassword123!",
    "full_name": "Alex Mercer",
    "tenant_name": "Acme Corp Platform"
  }
  ```
- **Validation Rules:**
  - `email`: Valid RFC 5322 format, lowercased, unique.
  - `password`: Minimum 10 characters, at least 1 uppercase, 1 lowercase, 1 number, 1 special character.
- **Response Schema (`201 Created`):**
  ```json
  {
    "user_id": "8a06e98b-21d3-4613-88bc-b0ee6b884d50",
    "email": "sre.lead@acme.com",
    "full_name": "Alex Mercer",
    "tenant_id": "c1f7b0f6-9304-4c57-897e-d309085ec617",
    "tenant_slug": "acme-corp-platform",
    "role": "TenantOwner",
    "created_at": "2026-11-18T12:00:00Z"
  }
  ```
- **Error Codes:** `400 Bad Request` (validation failed), `409 Conflict` (email already exists).

### 2.2 Login (Token Exchange)
- **Method & URL:** `POST /api/v1/auth/login`
- **Purpose:** Authenticates user credentials and issues short-lived JWT access token and secure refresh cookie.
- **Authentication:** None (Public)
- **Request Schema (`application/x-www-form-urlencoded` or JSON):**
  ```json
  {
    "username": "sre.lead@acme.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response Schema (`200 OK`):**
  - **Set-Cookie Header:** `refresh_token=<token>; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "expires_in": 900,
    "user": {
      "id": "8a06e98b-21d3-4613-88bc-b0ee6b884d50",
      "email": "sre.lead@acme.com",
      "full_name": "Alex Mercer",
      "active_tenant_id": "c1f7b0f6-9304-4c57-897e-d309085ec617",
      "role": "TenantOwner"
    }
  }
  ```
- **Error Codes:** `401 Unauthorized` (invalid credentials or deactivated user).

### 2.3 Refresh Token
- **Method & URL:** `POST /api/v1/auth/refresh`
- **Purpose:** Exchanges a valid HTTP-only refresh token for a fresh access token.
- **Authentication:** Refresh Token Cookie
- **Response Schema (`200 OK`):**
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "expires_in": 900
  }
  ```
- **Error Codes:** `401 Unauthorized` (expired or revoked refresh token).

---

## 3. Tenant Management Endpoints

### 3.1 Create Tenant
- **Method & URL:** `POST /api/v1/tenants`
- **Purpose:** Creates an additional organization tenant workspace.
- **Authentication:** Bearer Token
- **Authorization:** Authenticated User
- **Request Schema:**
  ```json
  {
    "name": "Acme SRE Lab",
    "slug": "acme-sre-lab"
  }
  ```
- **Response Schema (`201 Created`):**
  ```json
  {
    "id": "e22a59f6-0df7-45bf-90b5-772c918f8872",
    "name": "Acme SRE Lab",
    "slug": "acme-sre-lab",
    "tier": "standard",
    "created_at": "2026-11-18T12:05:00Z"
  }
  ```

### 3.2 List User Tenants
- **Method & URL:** `GET /api/v1/tenants`
- **Purpose:** Lists all tenants the authenticated user is a member of.
- **Response Schema (`200 OK`):**
  ```json
  {
    "items": [
      {
        "id": "c1f7b0f6-9304-4c57-897e-d309085ec617",
        "name": "Acme Corp Platform",
        "slug": "acme-corp-platform",
        "role": "TenantOwner"
      }
    ]
  }
  ```

### 3.3 Get Tenant Details
- **Method & URL:** `GET /api/v1/tenants/{id}`
- **Purpose:** Retrieves configuration and resource limits for a specific tenant.
- **Authorization:** `TenantOwner`, `Engineer`, or `Viewer` belonging to tenant `{id}`.
- **Response Schema (`200 OK`):**
  ```json
  {
    "id": "c1f7b0f6-9304-4c57-897e-d309085ec617",
    "name": "Acme Corp Platform",
    "slug": "acme-corp-platform",
    "tier": "standard",
    "resource_quotas": {
      "max_sandboxes": 5,
      "max_concurrent_experiments": 2,
      "max_nodes_per_topology": 20
    },
    "created_at": "2026-11-18T12:00:00Z"
  }
  ```

---

## 4. Project Management Endpoints

### 4.1 Create Project
- **Method & URL:** `POST /api/v1/projects`
- **Purpose:** Creates a project within the active tenant.
- **Authorization:** `TenantOwner` or `Engineer`
- **Request Schema:**
  ```json
  {
    "name": "E-Commerce Checkout Resilience",
    "slug": "ecommerce-checkout",
    "description": "Validating circuit breakers and timeouts between order and payment services."
  }
  ```
- **Response Schema (`201 Created`):**
  ```json
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "tenant_id": "c1f7b0f6-9304-4c57-897e-d309085ec617",
    "name": "E-Commerce Checkout Resilience",
    "slug": "ecommerce-checkout",
    "description": "Validating circuit breakers and timeouts between order and payment services.",
    "created_at": "2026-11-18T12:10:00Z"
  }
  ```

### 4.2 List Projects
- **Method & URL:** `GET /api/v1/projects`
- **Purpose:** Lists all projects within the active tenant.
- **Response Schema (`200 OK`):**
  ```json
  {
    "items": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "E-Commerce Checkout Resilience",
        "slug": "ecommerce-checkout",
        "sandboxes_count": 1,
        "experiments_count": 4,
        "created_at": "2026-11-18T12:10:00Z"
      }
    ]
  }
  ```

---

## 5. Topology Management Endpoints

### 5.1 Create Topology
- **Method & URL:** `POST /api/v1/topologies`
- **Purpose:** Defines a declarative microservice graph with service nodes and dependency edges.
- **Authorization:** `TenantOwner` or `Engineer`
- **Request Schema:**
  ```json
  {
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Retail Core Microservices v1",
    "services": [
      {
        "name": "api-gateway",
        "image": "chaos-platform/api-gateway:1.0",
        "container_port": 8080,
        "resource_limits": {"cpu_limit": "500m", "mem_limit": "512Mi"},
        "env_vars": {"ORDER_SERVICE_URL": "http://order-service:8080"}
      },
      {
        "name": "order-service",
        "image": "chaos-platform/order-service:1.0",
        "container_port": 8080,
        "resource_limits": {"cpu_limit": "500m", "mem_limit": "512Mi"},
        "env_vars": {"PAYMENT_SERVICE_URL": "http://payment-service:8080"}
      },
      {
        "name": "payment-service",
        "image": "chaos-platform/payment-service:1.0",
        "container_port": 8080,
        "resource_limits": {"cpu_limit": "500m", "mem_limit": "512Mi"},
        "env_vars": {"PSP_GATEWAY_URL": "http://psp-mock:8080"}
      }
    ],
    "dependencies": [
      {
        "source_service_name": "api-gateway",
        "target_service_name": "order-service",
        "protocol": "HTTP",
        "dependency_type": "synchronous"
      },
      {
        "source_service_name": "order-service",
        "target_service_name": "payment-service",
        "protocol": "HTTP",
        "dependency_type": "synchronous"
      }
    ],
    "graph_layout": {
      "nodes": [
        {"id": "api-gateway", "position": {"x": 100, "y": 150}},
        {"id": "order-service", "position": {"x": 350, "y": 150}},
        {"id": "payment-service", "position": {"x": 600, "y": 150}}
      ]
    }
  }
  ```
- **Response Schema (`201 Created`):** Returns saved topology with generated UUIDs and version 1.

### 5.2 Get Topology
- **Method & URL:** `GET /api/v1/topologies/{id}`
- **Response Schema (`200 OK`):** Returns complete topology graph structure.

### 5.3 Update Topology
- **Method & URL:** `PUT /api/v1/topologies/{id}`
- **Purpose:** Updates node configurations, adds/removes dependencies, and saves React Flow canvas coordinates.

---

## 6. Sandbox Management Endpoints

### 6.1 Provision Sandbox
- **Method & URL:** `POST /api/v1/sandboxes`
- **Purpose:** Asynchronously provisions an isolated Kubernetes namespace, deploys services, injects Toxiproxy sidecars, and applies NetworkPolicies.
- **Authorization:** `TenantOwner` or `Engineer`
- **Request Schema:**
  ```json
  {
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "topology_id": "7a35f560-6cc4-4a2e-9d22-1b15c7b960cf",
    "ttl_hours": 4
  }
  ```
- **Response Schema (`202 Accepted`):**
  - **Headers:** `Location: /api/v1/sandboxes/3fa85f64-5717-4562-b3fc-2c963f66afa6`
  ```json
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "topology_id": "7a35f560-6cc4-4a2e-9d22-1b15c7b960cf",
    "k8s_namespace": "sandbox-acme-3fa85f64",
    "status": "PROVISIONING",
    "expires_at": "2026-11-18T16:15:00Z",
    "created_at": "2026-11-18T12:15:00Z"
  }
  ```

### 6.2 Get Sandbox Status & Health
- **Method & URL:** `GET /api/v1/sandboxes/{id}`
- **Purpose:** Inspects real-time state of sandbox pods and sidecars.
- **Response Schema (`200 OK`):**
  ```json
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "k8s_namespace": "sandbox-acme-3fa85f64",
    "status": "READY",
    "services": [
      {
        "name": "order-service",
        "pod_status": "Running",
        "ready_containers": "2/2",
        "toxiproxy_active": true,
        "endpoint": "http://order-service.sandbox-acme-3fa85f64.svc:8080"
      },
      {
        "name": "payment-service",
        "pod_status": "Running",
        "ready_containers": "2/2",
        "toxiproxy_active": true,
        "endpoint": "http://payment-service.sandbox-acme-3fa85f64.svc:8080"
      }
    ],
    "expires_at": "2026-11-18T16:15:00Z"
  }
  ```

### 6.3 Delete Sandbox
- **Method & URL:** `DELETE /api/v1/sandboxes/{id}`
- **Purpose:** Asynchronously deletes all Kubernetes resources and tears down namespace.
- **Response Schema (`202 Accepted`):**
  ```json
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "status": "TERMINATING",
    "message": "Teardown queued for namespace sandbox-acme-3fa85f64."
  }
  ```

---

## 7. Chaos Experiment Endpoints

### 7.1 Create Experiment Specification
- **Method & URL:** `POST /api/v1/experiments`
- **Purpose:** Registers an experiment template.
- **Request Schema:**
  ```json
  {
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Payment Latency 2000ms",
    "description": "Injects 2s network latency on payment-service to verify order-service timeout.",
    "fault_type": "latency",
    "duration_seconds": 60,
    "configuration": {
      "target_service": "payment-service",
      "direction": "downstream",
      "latency_ms": 2000,
      "jitter_ms": 300,
      "toxicity": 1.0
    }
  }
  ```
- **Response Schema (`201 Created`):** Returns saved experiment entity.

### 7.2 Run Chaos Experiment
- **Method & URL:** `POST /api/v1/experiments/{id}/run`
- **Purpose:** Executes experiment against an active sandbox.
- **Authorization:** `TenantOwner` or `Engineer`
- **Request Schema:**
  ```json
  {
    "sandbox_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
  }
  ```
- **Response Schema (`202 Accepted`):**
  ```json
  {
    "run_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "experiment_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "sandbox_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "status": "RUNNING",
    "started_at": "2026-11-18T12:20:00Z",
    "active_fault": {
      "type": "latency",
      "target_service": "payment-service",
      "parameters": {"latency_ms": 2000, "jitter_ms": 300}
    }
  }
  ```
- **Error Codes:** `409 Conflict` (another experiment is already actively running in this sandbox).

### 7.3 Stop Chaos Experiment (Kill Switch)
- **Method & URL:** `POST /api/v1/experiments/{id}/stop`
- **Purpose:** Immediately removes all active toxics and halts experiment run.
- **Response Schema (`200 OK`):**
  ```json
  {
    "run_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "status": "ABORTED",
    "message": "All injected faults successfully revoked. Sandbox network restored to steady state.",
    "completed_at": "2026-11-18T12:20:45Z"
  }
  ```

---

## 8. Incident & Root Cause Analysis Endpoints

### 8.1 List Incidents
- **Method & URL:** `GET /api/v1/incidents`
- **Query Parameters:** `sandbox_id`, `status`, `severity`, `limit`, `offset`
- **Response Schema (`200 OK`):**
  ```json
  {
    "items": [
      {
        "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "experiment_run_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        "title": "Elevated P99 Latency > 2000ms on order-service",
        "severity": "CRITICAL",
        "status": "DETECTED",
        "detected_at": "2026-11-18T12:20:18Z"
      }
    ]
  }
  ```

### 8.2 Get Incident Details
- **Method & URL:** `GET /api/v1/incidents/{id}`
- **Response Schema (`200 OK`):** Returns incident status, affected sandbox, and triggering metric thresholds.

### 8.3 Analyze Incident (Trigger Deterministic RCA + AI)
- **Method & URL:** `POST /api/v1/incidents/{id}/analyze`
- **Purpose:** Executes deterministic causal graph analysis followed by grounded AI post-mortem synthesis.
- **Response Schema (`200 OK`):**
  ```json
  {
    "incident_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "status": "ANALYZED",
    "primary_root_cause": {
      "service_name": "payment-service",
      "confidence_score": 0.94,
      "classification": "ROOT_CAUSE"
    },
    "ranked_candidates": [
      {
        "service_name": "payment-service",
        "confidence_score": 0.94,
        "classification": "ROOT_CAUSE",
        "temporal_rank": 1,
        "trace_self_time_ratio": 0.97
      },
      {
        "service_name": "order-service",
        "confidence_score": 0.41,
        "classification": "DOWNSTREAM_SYMPTOM",
        "temporal_rank": 2,
        "trace_self_time_ratio": 0.03
      }
    ],
    "ai_explanation": {
      "executive_summary": "Payment Service experienced a 2000ms transport delay, causing Order Service worker threads to block and fail with 504 Gateway Timeout.",
      "causal_propagation_chain": [
        "1. Injected 2000ms latency on payment-service:8080 ingress.",
        "2. Payment handler duration spiked from 45ms to 2045ms.",
        "3. Order Service synchronous HTTP client exhausted its 50-thread connection pool.",
        "4. Inbound requests to Order Service queued and timed out after 5000ms."
      ],
      "remediation_recommendations": [
        "Reduce Order Service HTTP client timeout from 5000ms to 1200ms.",
        "Implement a Circuit Breaker on the Payment client (open after 5 consecutive timeouts).",
        "Introduce an asynchronous message queue (e.g., Redis/Kafka) for non-blocking payment processing."
      ]
    }
  }
  ```

---

## 9. Report Export Endpoints

### 9.1 Download Incident Post-Mortem Report
- **Method & URL:** `GET /api/v1/incidents/{id}/report`
- **Query Parameters:** `format=json|markdown|pdf`
- **Response Formats:**
  - `format=markdown`: Returns `text/markdown; charset=utf-8` document.
  - `format=pdf`: Returns `application/pdf` binary with `Content-Disposition: attachment; filename="RCA-Report-f47ac10b.pdf"`.
  - `format=json`: Returns raw structured RCA report object.
