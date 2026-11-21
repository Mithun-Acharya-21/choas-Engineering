"""Pytest fixtures for ChaosEngine AI backend tests."""

import datetime
from typing import Dict, List
from uuid import UUID, uuid4
import pytest
from fastapi.testclient import TestClient

from backend.app.api.v1.sandboxes import set_sandbox_service
from backend.app.core.security import create_access_token
from backend.app.domains.sandbox.k8s_client import K8sClientWrapper
from backend.app.domains.sandbox.service import (
    _AUDIT_LOGS,
    _IDEMPOTENCY_CACHE,
    _SANDBOX_DB,
    SandboxService,
)
from backend.app.main import app

# Standard test UUIDs
TEST_TENANT_ID = UUID("c1f7b0f6-9304-4c57-897e-d309085ec617")
OTHER_TENANT_ID = UUID("e22a59f6-0df7-45bf-90b5-772c918f8872")
TEST_PROJECT_ID = UUID("550e8400-e29b-41d4-a716-446655440000")
OTHER_PROJECT_ID = UUID("550e8400-e29b-41d4-a716-446655440002")

OWNER_USER_ID = UUID("11111111-1111-1111-1111-111111111111")
ENGINEER_USER_ID = UUID("22222222-2222-2222-2222-222222222222")
VIEWER_USER_ID = UUID("33333333-3333-3333-3333-333333333333")


class MockK8sClient(K8sClientWrapper):
    """In-memory mock of Kubernetes client for unit tests."""

    def __init__(self):
        super().__init__()
        self.namespaces: Dict[str, Dict] = {}
        self.quotas: Dict[str, Dict] = {}
        self.limits: Dict[str, Dict] = {}
        self.network_policies: Dict[str, Dict] = {}
        self.deployments: Dict[str, Dict] = {}
        self.services: Dict[str, Dict] = {}
        self.rbac: Dict[str, List] = {}
        self._initialized = True

    @property
    def is_connected(self) -> bool:
        return True

    def create_namespace(self, manifest: Dict):
        name = manifest["metadata"]["name"]
        self.namespaces[name] = manifest

    def delete_namespace(self, namespace: str):
        self.namespaces.pop(namespace, None)
        self.quotas.pop(namespace, None)
        self.limits.pop(namespace, None)
        self.network_policies.pop(namespace, None)

    def namespace_exists(self, namespace: str) -> bool:
        return namespace in self.namespaces

    def list_sandbox_namespaces(self) -> List[str]:
        return list(self.namespaces.keys())

    def apply_resource_quota(self, namespace: str, manifest: Dict):
        self.quotas[namespace] = manifest

    def apply_limit_range(self, namespace: str, manifest: Dict):
        self.limits[namespace] = manifest

    def apply_network_policy(self, namespace: str, manifest: Dict):
        self.network_policies[namespace] = manifest

    def apply_rbac(self, namespace: str, manifests: List[Dict]):
        self.rbac[namespace] = manifests

    def create_deployment(self, namespace: str, manifest: Dict):
        self.deployments[f"{namespace}/{manifest['metadata']['name']}"] = manifest

    def create_service(self, namespace: str, manifest: Dict):
        self.services[f"{namespace}/{manifest['metadata']['name']}"] = manifest

    def get_pods(self, namespace: str) -> List:
        return []


@pytest.fixture
def mock_k8s():
    return MockK8sClient()


@pytest.fixture(autouse=True)
def clean_database(mock_k8s):
    """Resets in-memory sandbox and cache state between test runs."""
    _SANDBOX_DB.clear()
    _IDEMPOTENCY_CACHE.clear()
    _AUDIT_LOGS.clear()
    svc = SandboxService(k8s_client=mock_k8s)
    set_sandbox_service(svc)
    yield
    _SANDBOX_DB.clear()
    _IDEMPOTENCY_CACHE.clear()
    _AUDIT_LOGS.clear()


@pytest.fixture
def owner_token() -> str:
    return create_access_token(
        user_id=str(OWNER_USER_ID),
        tenant_id=str(TEST_TENANT_ID),
        role="TenantOwner",
        email="sre.lead@acme.com",
    )


@pytest.fixture
def engineer_token() -> str:
    return create_access_token(
        user_id=str(ENGINEER_USER_ID),
        tenant_id=str(TEST_TENANT_ID),
        role="Engineer",
        email="dev.engineer@acme.com",
    )


@pytest.fixture
def viewer_token() -> str:
    return create_access_token(
        user_id=str(VIEWER_USER_ID),
        tenant_id=str(TEST_TENANT_ID),
        role="Viewer",
        email="auditor.compliance@acme.com",
    )


@pytest.fixture
def other_tenant_token() -> str:
    return create_access_token(
        user_id=str(uuid4()),
        tenant_id=str(OTHER_TENANT_ID),
        role="TenantOwner",
        email="operator@other-tenant.com",
    )


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
