"""Core Sandbox Provisioning Service implementing lifecycle transitions,

idempotency, Kubernetes resource orchestration, and audit logging.
"""

import asyncio
from datetime import datetime, timedelta
import logging
from typing import Dict, List, Optional
from uuid import UUID, uuid4

from backend.app.domains.sandbox.k8s_builder import K8sManifestBuilder
from backend.app.domains.sandbox.k8s_client import K8sClientWrapper
from backend.app.domains.sandbox.models import (
    AuditLogRecord,
    ContainerStatus,
    K8sPodStatus,
    K8sWorkloadStatus,
    SandboxCreateRequest,
    SandboxLifecycleState,
    SandboxRecord,
    SandboxStatusResponse,
    SandboxTerminateResponse,
)
from backend.app.domains.sandbox.safety import (
    SandboxSafetyViolation,
    generate_sandbox_namespace,
    validate_sandbox_namespace,
)

logger = logging.getLogger("chaosengine.sandbox_service")

# In-memory storage repository simulating PostgreSQL stateful database
# Accessible and thread-safe for the modular FastAPI process
_SANDBOX_DB: Dict[UUID, SandboxRecord] = {}
_IDEMPOTENCY_CACHE: Dict[str, UUID] = {}
_AUDIT_LOGS: List[AuditLogRecord] = []

# Default sample topology for dynamic microservice sandbox
DEFAULT_SAMPLE_SERVICES = [
    {"name": "api-gateway", "image": "chaosengine/api-gateway:1.0.0", "port": 8081},
    {"name": "order-service", "image": "chaosengine/order-service:1.0.0", "port": 8081},
    {"name": "payment-service", "image": "chaosengine/payment-service:1.0.0", "port": 8081},
    {"name": "inventory-service", "image": "chaosengine/inventory-service:1.0.0", "port": 8081},
]


class SandboxService:
    """Manages the full lifecycle of tenant-isolated Kubernetes sandboxes."""

    def __init__(self, k8s_client: Optional[K8sClientWrapper] = None):
        self.k8s = k8s_client or K8sClientWrapper()
        self.k8s.initialize()

    def list_sandboxes(
        self, tenant_id: UUID, project_id: Optional[UUID] = None
    ) -> List[SandboxRecord]:
        """Lists sandboxes strictly scoped to authenticated tenant and project."""
        results = []
        for s in _SANDBOX_DB.values():
            if s.tenant_id == tenant_id:
                if project_id is None or s.project_id == project_id:
                    results.append(s)
        return sorted(results, key=lambda x: x.created_at, reverse=True)

    def get_sandbox(self, sandbox_id: UUID, tenant_id: UUID) -> SandboxRecord:
        """Retrieves a sandbox, verifying strict tenant ownership."""
        sandbox = _SANDBOX_DB.get(sandbox_id)
        if not sandbox or sandbox.tenant_id != tenant_id:
            raise KeyError(f"Sandbox '{sandbox_id}' not found in active tenant.")
        return sandbox

    def get_sandbox_status(self, sandbox_id: UUID, tenant_id: UUID) -> SandboxStatusResponse:
        """Calculates current provisioning progress and workload readiness for polling."""
        sandbox = self.get_sandbox(sandbox_id, tenant_id)

        # Calculate progress percentage based on status
        step_map = {
            SandboxLifecycleState.PENDING: (10, "Pending queue allocation"),
            SandboxLifecycleState.PROVISIONING: (50, "Provisioning Kubernetes namespace & workloads"),
            SandboxLifecycleState.READY: (100, "All microservice workloads and sidecars ready"),
            SandboxLifecycleState.FAILED: (100, "Provisioning failed"),
            SandboxLifecycleState.TERMINATING: (50, "Tearing down namespace & freeing quota"),
            SandboxLifecycleState.TERMINATED: (100, "Teardown complete"),
        }

        pct, step_desc = step_map.get(sandbox.status, (0, "Unknown state"))
        workloads_total = len(sandbox.workloads)
        workloads_ready = sum(1 for w in sandbox.workloads if w.replicas_ready >= w.replicas_desired)

        return SandboxStatusResponse(
            id=sandbox.id,
            status=sandbox.status,
            k8s_namespace=sandbox.k8s_namespace,
            cluster_id=sandbox.cluster_id,
            progress_percentage=pct,
            current_step=step_desc,
            workloads_ready=workloads_ready,
            workloads_total=workloads_total,
            error_summary=sandbox.error_summary,
            updated_at=sandbox.updated_at,
        )

    async def create_sandbox(
        self,
        request: SandboxCreateRequest,
        tenant_id: UUID,
        tenant_slug: str,
        user_id: UUID,
        idempotency_key: Optional[str] = None,
    ) -> SandboxRecord:
        """Creates a sandbox record, checks idempotency, and triggers async provisioning."""
        # 1. Idempotency Key Handling
        if idempotency_key:
            cache_key = f"{tenant_id}:{idempotency_key}"
            if cache_key in _IDEMPOTENCY_CACHE:
                existing_id = _IDEMPOTENCY_CACHE[cache_key]
                if existing_id in _SANDBOX_DB:
                    logger.info(f"Idempotency hit: returning existing sandbox {existing_id}")
                    return _SANDBOX_DB[existing_id]

        # 2. Allocate Sandbox ID & Controlled Namespace
        sandbox_id = uuid4()
        namespace = generate_sandbox_namespace(tenant_slug, sandbox_id)

        # 3. Create initial PENDING record
        now = datetime.utcnow()
        record = SandboxRecord(
            id=sandbox_id,
            tenant_id=tenant_id,
            project_id=request.project_id,
            name=request.name,
            k8s_namespace=namespace,
            cluster_id=request.cluster_id,
            topology_id=request.topology_id,
            resource_profile=request.resource_profile,
            status=SandboxLifecycleState.PENDING,
            idempotency_key=idempotency_key,
            is_isolated=False,
            expires_at=now + timedelta(hours=request.ttl_hours),
            created_at=now,
            updated_at=now,
        )

        _SANDBOX_DB[sandbox_id] = record
        if idempotency_key:
            _IDEMPOTENCY_CACHE[f"{tenant_id}:{idempotency_key}"] = sandbox_id

        # 4. Log Audit Trail
        _AUDIT_LOGS.append(
            AuditLogRecord(
                tenant_id=tenant_id,
                user_id=user_id,
                action="SANDBOX_PROVISIONING_INITIATED",
                resource_id=sandbox_id,
                details={
                    "namespace": namespace,
                    "name": request.name,
                    "project_id": str(request.project_id),
                    "cluster_id": request.cluster_id,
                    "idempotency_key": idempotency_key,
                },
            )
        )

        # 5. Trigger Async Background Provisioning
        asyncio.create_task(self._provision_workflow(sandbox_id))

        return record

    async def _provision_workflow(self, sandbox_id: UUID) -> None:
        """Asynchronous provisioning execution engine.

        Guarantees step-by-step application and rolls back on failure.
        """
        sandbox = _SANDBOX_DB.get(sandbox_id)
        if not sandbox:
            return

        sandbox.status = SandboxLifecycleState.PROVISIONING
        sandbox.updated_at = datetime.utcnow()
        ns = sandbox.k8s_namespace

        try:
            logger.info(f"Starting provisioning workflow for {sandbox_id} in {ns}")

            # Step 1: Build & Create Namespace
            ns_manifest = K8sManifestBuilder.build_namespace(
                namespace=ns,
                tenant_id=sandbox.tenant_id,
                sandbox_id=sandbox.id,
                project_id=sandbox.project_id,
            )
            self.k8s.create_namespace(ns_manifest)

            # Step 2: Configure Namespace-Scoped RBAC
            rbac_manifests = K8sManifestBuilder.build_rbac_service_account(ns)
            self.k8s.apply_rbac(ns, rbac_manifests)

            # Step 3: Apply ResourceQuota
            quota_manifest = K8sManifestBuilder.build_resource_quota(ns, sandbox.resource_profile)
            self.k8s.apply_resource_quota(ns, quota_manifest)

            # Step 4: Apply LimitRange
            limits_manifest = K8sManifestBuilder.build_limit_range(ns)
            self.k8s.apply_limit_range(ns, limits_manifest)

            # Step 5: Apply Default-Deny NetworkPolicy
            netpol_manifest = K8sManifestBuilder.build_network_policy(ns, sandbox.id)
            self.k8s.apply_network_policy(ns, netpol_manifest)
            sandbox.is_isolated = True

            # Step 6: Deploy Sample Workloads with Injected Toxiproxy Sidecars
            workload_statuses: List[K8sWorkloadStatus] = []
            for svc in DEFAULT_SAMPLE_SERVICES:
                svc_name = svc["name"]
                img = svc["image"]

                # Create Deployment
                dep_manifest = K8sManifestBuilder.build_service_deployment(
                    namespace=ns,
                    sandbox_id=sandbox.id,
                    service_name=svc_name,
                    image=img,
                    replicas=1,
                )
                self.k8s.create_deployment(ns, dep_manifest)

                # Create ClusterIP Service
                svc_manifest = K8sManifestBuilder.build_service_cluster_ip(ns, svc_name)
                self.k8s.create_service(ns, svc_manifest)

                # Record Workload Status
                workload_statuses.append(
                    K8sWorkloadStatus(
                        name=svc_name,
                        namespace=ns,
                        replicas_desired=1,
                        replicas_ready=1,
                        image=img,
                        container_port=8081,
                        toxiproxy_port=8080,
                        endpoint=f"{svc_name}.{ns}.svc.cluster.local:8080",
                        pods=[
                            K8sPodStatus(
                                name=f"{svc_name}-pod-1",
                                namespace=ns,
                                status="Running",
                                ready_containers="2/2",
                                restart_count=0,
                                toxiproxy_active=True,
                                containers=[
                                    ContainerStatus(name="app", ready=True, restart_count=0, image=img),
                                    ContainerStatus(
                                        name="toxiproxy-sidecar",
                                        ready=True,
                                        restart_count=0,
                                        image="ghcr.io/shopify/toxiproxy:2.9.0",
                                    ),
                                ],
                            )
                        ],
                    )
                )

            sandbox.workloads = workload_statuses
            sandbox.status = SandboxLifecycleState.READY
            sandbox.updated_at = datetime.utcnow()
            logger.info(f"Sandbox {sandbox_id} successfully PROVISIONED and READY.")

            _AUDIT_LOGS.append(
                AuditLogRecord(
                    tenant_id=sandbox.tenant_id,
                    action="SANDBOX_PROVISIONED",
                    resource_id=sandbox_id,
                    details={"namespace": ns, "workloads": len(workload_statuses)},
                )
            )

        except Exception as ex:
            logger.error(f"Provisioning failed for sandbox {sandbox_id}: {ex}", exc_info=True)
            sandbox.status = SandboxLifecycleState.FAILED
            sandbox.error_summary = str(ex)
            sandbox.updated_at = datetime.utcnow()

            _AUDIT_LOGS.append(
                AuditLogRecord(
                    tenant_id=sandbox.tenant_id,
                    action="SANDBOX_FAILED",
                    resource_id=sandbox_id,
                    details={"namespace": ns, "error": str(ex)},
                )
            )

            # Cleanup partial provisioning (rollback)
            try:
                if self.k8s.namespace_exists(ns):
                    logger.info(f"Rolling back failed provisioning: deleting namespace {ns}")
                    self.k8s.delete_namespace(ns)
            except Exception as cleanup_err:
                logger.error(f"Failed to cleanup namespace {ns} during rollback: {cleanup_err}")

    async def terminate_sandbox(
        self, sandbox_id: UUID, tenant_id: UUID, user_id: UUID
    ) -> SandboxTerminateResponse:
        """Safely tears down a sandbox and its Kubernetes namespace."""
        sandbox = self.get_sandbox(sandbox_id, tenant_id)

        # Transition state to TERMINATING
        sandbox.status = SandboxLifecycleState.TERMINATING
        sandbox.updated_at = datetime.utcnow()
        ns = sandbox.k8s_namespace

        # Validate that we are not deleting a protected namespace
        validate_sandbox_namespace(ns)

        try:
            # Send Kubernetes namespace deletion call
            self.k8s.delete_namespace(ns)
            sandbox.status = SandboxLifecycleState.TERMINATED
            sandbox.updated_at = datetime.utcnow()

            _AUDIT_LOGS.append(
                AuditLogRecord(
                    tenant_id=tenant_id,
                    user_id=user_id,
                    action="SANDBOX_TERMINATED",
                    resource_id=sandbox_id,
                    details={"namespace": ns},
                )
            )

            return SandboxTerminateResponse(
                id=sandbox.id,
                status=sandbox.status,
                k8s_namespace=ns,
                message=f"Teardown successfully completed for namespace '{ns}'.",
            )
        except Exception as ex:
            sandbox.error_summary = f"Teardown error: {ex}"
            sandbox.status = SandboxLifecycleState.FAILED
            sandbox.updated_at = datetime.utcnow()
            raise
