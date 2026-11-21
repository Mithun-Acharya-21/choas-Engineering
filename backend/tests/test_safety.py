"""Unit tests for safety guardrails and namespace protections."""

from uuid import uuid4
import pytest
from backend.app.domains.sandbox.safety import (
    SandboxSafetyViolation,
    generate_sandbox_namespace,
    validate_container_image,
    validate_sandbox_namespace,
)


def test_generate_sandbox_namespace():
    sandbox_id = uuid4()
    ns = generate_sandbox_namespace("Acme Corp Platform", sandbox_id)
    assert ns.startswith("sandbox-acme-corp-platform-")
    assert len(ns) <= 63


@pytest.mark.parametrize(
    "forbidden_ns",
    [
        "default",
        "kube-system",
        "kube-public",
        "kube-node-lease",
        "chaos-control-plane",
        "prod-us-east-1",
        "production",
        "production-db",
        "live-checkout",
        "staging-mesh",
        "stage",
        "main",
        "infrastructure",
    ],
)
def test_validate_sandbox_namespace_blocks_protected_namespaces(forbidden_ns: str):
    with pytest.raises(SandboxSafetyViolation):
        validate_sandbox_namespace(forbidden_ns)


def test_validate_sandbox_namespace_blocks_non_sandbox_prefix():
    with pytest.raises(SandboxSafetyViolation):
        validate_sandbox_namespace("custom-workload-ns")


def test_validate_container_image_accepts_catalog():
    validate_container_image("chaosengine/order-service:1.0.0")
    validate_container_image("ghcr.io/shopify/toxiproxy:2.9.0")


def test_validate_container_image_rejects_arbitrary_images():
    with pytest.raises(SandboxSafetyViolation):
        validate_container_image("ubuntu:latest")

    with pytest.raises(SandboxSafetyViolation):
        validate_container_image("crypto-miner:v1")
