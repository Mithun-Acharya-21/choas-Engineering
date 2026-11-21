"""Unit tests for SandboxService business logic and provisioning workflow."""

import asyncio
from uuid import uuid4
import pytest
from backend.app.domains.sandbox.models import (
    ResourceProfile,
    SandboxCreateRequest,
    SandboxLifecycleState,
)
from backend.app.domains.sandbox.service import (
    _AUDIT_LOGS,
    _SANDBOX_DB,
    SandboxService,
)


def test_create_sandbox_and_provision_workflow(mock_k8s):
    async def _test():
        service = SandboxService(k8s_client=mock_k8s)
        tenant_id = uuid4()
        user_id = uuid4()
        project_id = uuid4()

        req = SandboxCreateRequest(
            name="Checkout Sandbox Alpha",
            project_id=project_id,
            resource_profile=ResourceProfile(cpu_request="2", cpu_limit="4"),
            ttl_hours=4,
        )

        record = await service.create_sandbox(
            request=req,
            tenant_id=tenant_id,
            tenant_slug="acme-corp",
            user_id=user_id,
        )

        assert record.name == "Checkout Sandbox Alpha"
        assert record.tenant_id == tenant_id
        assert record.project_id == project_id
        assert record.k8s_namespace.startswith("sandbox-acme-corp-")

        # Allow async provisioning task to run
        await asyncio.sleep(0.05)

        updated = service.get_sandbox(record.id, tenant_id)
        assert updated.status == SandboxLifecycleState.READY
        assert updated.is_isolated is True
        assert len(updated.workloads) == 4

        # Verify Mock Kubernetes objects created
        assert mock_k8s.namespace_exists(updated.k8s_namespace)
        assert updated.k8s_namespace in mock_k8s.quotas
        assert updated.k8s_namespace in mock_k8s.network_policies

    asyncio.run(_test())


def test_idempotent_creation_returns_existing_record(mock_k8s):
    async def _test():
        service = SandboxService(k8s_client=mock_k8s)
        tenant_id = uuid4()
        user_id = uuid4()
        project_id = uuid4()
        key = "idem-key-12345"

        req = SandboxCreateRequest(name="Sandbox Idem", project_id=project_id)

        rec1 = await service.create_sandbox(
            request=req,
            tenant_id=tenant_id,
            tenant_slug="acme-corp",
            user_id=user_id,
            idempotency_key=key,
        )

        rec2 = await service.create_sandbox(
            request=req,
            tenant_id=tenant_id,
            tenant_slug="acme-corp",
            user_id=user_id,
            idempotency_key=key,
        )

        assert rec1.id == rec2.id
        assert len(_SANDBOX_DB) == 1

    asyncio.run(_test())


def test_terminate_sandbox_deletes_k8s_resources(mock_k8s):
    async def _test():
        service = SandboxService(k8s_client=mock_k8s)
        tenant_id = uuid4()
        user_id = uuid4()

        req = SandboxCreateRequest(name="Sandbox to Terminate", project_id=uuid4())
        record = await service.create_sandbox(req, tenant_id, "acme", user_id)
        await asyncio.sleep(0.05)

        assert mock_k8s.namespace_exists(record.k8s_namespace)

        term_res = await service.terminate_sandbox(record.id, tenant_id, user_id)
        assert term_res.status == SandboxLifecycleState.TERMINATED
        assert not mock_k8s.namespace_exists(record.k8s_namespace)

    asyncio.run(_test())


def test_cross_tenant_access_rejected(mock_k8s):
    async def _test():
        service = SandboxService(k8s_client=mock_k8s)
        tenant_a = uuid4()
        tenant_b = uuid4()
        user_id = uuid4()

        req = SandboxCreateRequest(name="Tenant A Sandbox", project_id=uuid4())
        record = await service.create_sandbox(req, tenant_a, "acme-a", user_id)

        with pytest.raises(KeyError):
            service.get_sandbox(record.id, tenant_b)

        with pytest.raises(KeyError):
            await service.terminate_sandbox(record.id, tenant_b, user_id)

    asyncio.run(_test())

