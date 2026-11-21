"""Unit tests for the reconciliation and watchdog engine."""

import asyncio
from datetime import datetime, timedelta
from uuid import uuid4
import pytest
from backend.app.domains.sandbox.models import (
    ResourceProfile,
    SandboxLifecycleState,
    SandboxRecord,
)
from backend.app.domains.sandbox.reconciler import SandboxReconciler
from backend.app.domains.sandbox.service import _SANDBOX_DB


def test_reconciler_recovers_stuck_provisioning_sandbox(mock_k8s):
    async def _test():
        reconciler = SandboxReconciler(mock_k8s)
        tenant_id = uuid4()
        sandbox_id = uuid4()
        ns = f"sandbox-acme-{str(sandbox_id)[:8]}"

        # Simulate sandbox stuck in PROVISIONING for 10 minutes
        stuck_time = datetime.utcnow() - timedelta(minutes=10)
        record = SandboxRecord(
            id=sandbox_id,
            tenant_id=tenant_id,
            project_id=uuid4(),
            name="Stuck Sandbox",
            k8s_namespace=ns,
            cluster_id="sandbox-alpha-us-east-1",
            resource_profile=ResourceProfile(),
            status=SandboxLifecycleState.PROVISIONING,
            expires_at=datetime.utcnow() + timedelta(hours=4),
            created_at=stuck_time,
            updated_at=stuck_time,
        )
        _SANDBOX_DB[sandbox_id] = record
        mock_k8s.namespaces[ns] = {"metadata": {"name": ns}}

        report = await reconciler.run_reconciliation()

        assert report["stuck_sandboxes_recovered"] == 1
        assert record.status == SandboxLifecycleState.FAILED
        assert "timed out" in record.error_summary
        assert not mock_k8s.namespace_exists(ns)

    asyncio.run(_test())


def test_reconciler_purges_orphaned_kubernetes_namespaces(mock_k8s):
    async def _test():
        reconciler = SandboxReconciler(mock_k8s)

        # Simulate an orphaned namespace in Kubernetes that has no DB record
        orphan_ns = "sandbox-orphan-deadbeef"
        mock_k8s.namespaces[orphan_ns] = {"metadata": {"name": orphan_ns}}

        assert mock_k8s.namespace_exists(orphan_ns)

        report = await reconciler.run_reconciliation()

        assert report["orphaned_namespaces_purged"] == 1
        assert not mock_k8s.namespace_exists(orphan_ns)

    asyncio.run(_test())


def test_reconciler_terminates_expired_sandboxes(mock_k8s):
    async def _test():
        reconciler = SandboxReconciler(mock_k8s)
        tenant_id = uuid4()
        sandbox_id = uuid4()
        ns = f"sandbox-acme-{str(sandbox_id)[:8]}"

        # Sandbox whose TTL has passed
        expired_time = datetime.utcnow() - timedelta(minutes=5)
        record = SandboxRecord(
            id=sandbox_id,
            tenant_id=tenant_id,
            project_id=uuid4(),
            name="Expired Sandbox",
            k8s_namespace=ns,
            cluster_id="sandbox-alpha-us-east-1",
            resource_profile=ResourceProfile(),
            status=SandboxLifecycleState.READY,
            expires_at=expired_time,
            created_at=expired_time - timedelta(hours=4),
            updated_at=expired_time,
        )
        _SANDBOX_DB[sandbox_id] = record
        mock_k8s.namespaces[ns] = {"metadata": {"name": ns}}

        report = await reconciler.run_reconciliation()

        assert report["expired_sandboxes_terminated"] == 1
        assert record.status == SandboxLifecycleState.TERMINATED
        assert not mock_k8s.namespace_exists(ns)

    asyncio.run(_test())

