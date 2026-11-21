"""Reconciliation watchdog engine.

Reconciles database records against live Kubernetes state, detects and purges
orphaned namespaces, recovers stuck provisioning workflows, and enforces TTL limits.
"""

from datetime import datetime
import logging
from typing import Dict, List
from uuid import UUID

from backend.app.core.config import settings
from backend.app.domains.sandbox.k8s_client import K8sClientWrapper
from backend.app.domains.sandbox.models import SandboxLifecycleState
from backend.app.domains.sandbox.safety import validate_sandbox_namespace
from backend.app.domains.sandbox.service import _SANDBOX_DB

logger = logging.getLogger("chaosengine.reconciler")


class SandboxReconciler:
    """Watchdog loop reconciling Kubernetes namespaces and PostgreSQL sandbox state."""

    def __init__(self, k8s_client: K8sClientWrapper):
        self.k8s = k8s_client

    async def run_reconciliation(self) -> Dict[str, Any]:
        """Executes a full reconciliation pass."""
        now = datetime.utcnow()
        report: Dict[str, Any] = {
            "stuck_sandboxes_recovered": 0,
            "expired_sandboxes_terminated": 0,
            "orphaned_namespaces_purged": 0,
            "timestamp": now.isoformat(),
        }

        # 1. Recover sandboxes stuck in PROVISIONING beyond timeout
        for sandbox in list(_SANDBOX_DB.values()):
            if sandbox.status == SandboxLifecycleState.PROVISIONING:
                elapsed_seconds = (now - sandbox.updated_at).total_seconds()
                if elapsed_seconds > settings.K8S_PROVISIONING_TIMEOUT_SECONDS:
                    logger.warning(
                        f"Sandbox {sandbox.id} stuck in PROVISIONING for {elapsed_seconds}s. Marking FAILED."
                    )
                    sandbox.status = SandboxLifecycleState.FAILED
                    sandbox.error_summary = (
                        f"Provisioning timed out after {int(elapsed_seconds)} seconds."
                    )
                    sandbox.updated_at = now
                    report["stuck_sandboxes_recovered"] += 1

                    # Trigger namespace cleanup
                    if self.k8s.namespace_exists(sandbox.k8s_namespace):
                        try:
                            self.k8s.delete_namespace(sandbox.k8s_namespace)
                        except Exception as e:
                            logger.error(f"Failed to delete namespace for stuck sandbox: {e}")

        # 2. Terminate sandboxes exceeding expires_at TTL
        for sandbox in list(_SANDBOX_DB.values()):
            if sandbox.status == SandboxLifecycleState.READY and now > sandbox.expires_at:
                logger.info(f"Sandbox {sandbox.id} reached TTL expiration ({sandbox.expires_at}). Terminating.")
                sandbox.status = SandboxLifecycleState.TERMINATING
                sandbox.updated_at = now
                try:
                    validate_sandbox_namespace(sandbox.k8s_namespace)
                    self.k8s.delete_namespace(sandbox.k8s_namespace)
                    sandbox.status = SandboxLifecycleState.TERMINATED
                    report["expired_sandboxes_terminated"] += 1
                except Exception as ex:
                    logger.error(f"Error terminating expired sandbox {sandbox.id}: {ex}")

        # 3. Detect and purge orphaned Kubernetes namespaces
        active_k8s_namespaces = self.k8s.list_sandbox_namespaces()
        known_active_namespaces = {
            s.k8s_namespace
            for s in _SANDBOX_DB.values()
            if s.status in [SandboxLifecycleState.PENDING, SandboxLifecycleState.PROVISIONING, SandboxLifecycleState.READY]
        }

        for ns in active_k8s_namespaces:
            if ns not in known_active_namespaces:
                # Extra safety check before deleting any namespace
                try:
                    validate_sandbox_namespace(ns)
                    logger.warning(f"Detected orphaned sandbox namespace in Kubernetes: '{ns}'. Purging.")
                    self.k8s.delete_namespace(ns)
                    report["orphaned_namespaces_purged"] += 1
                except Exception as ex:
                    logger.error(f"Safety guardrail or API error preventing orphan purge of '{ns}': {ex}")

        return report
