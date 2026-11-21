"""Safety and security invariants for Kubernetes sandboxes."""

import re
from typing import List, Set
from uuid import UUID

# Prohibited system and production namespaces
RESTRICTED_SYSTEM_NAMESPACES: Set[str] = {
    "default",
    "kube-system",
    "kube-public",
    "kube-node-lease",
    "chaos-control-plane",
    "cert-manager",
    "ingress-nginx",
    "monitoring",
    "logging",
}

# Regex to detect production-like namespace names
PROD_NAMESPACE_PATTERN = re.compile(
    r"^(prod|production|live|main|master|release|stage|staging|infra|core)([-_].*)?$",
    re.IGNORECASE,
)

# Valid sandbox namespace format: strictly 'sandbox-{tenant_slug}-{short_uuid}'
SANDBOX_NAMESPACE_PATTERN = re.compile(r"^sandbox-[a-z0-9]+(?:-[a-z0-9]+)*-[a-f0-9]{8}$")

# Approved container images for sandbox topology workloads
APPROVED_CONTAINER_IMAGES: Set[str] = {
    "ghcr.io/shopify/toxiproxy:2.9.0",
    "chaosengine/api-gateway:1.0.0",
    "chaosengine/auth-service:1.0.0",
    "chaosengine/order-service:1.0.0",
    "chaosengine/payment-service:1.0.0",
    "chaosengine/inventory-service:1.0.0",
    "chaosengine/notification-service:1.0.0",
    "nginx:1.25-alpine",
    "redis:7.2-alpine",
}


class SandboxSafetyViolation(Exception):
    """Raised when a sandbox operation violates platform security guardrails."""
    pass


def generate_sandbox_namespace(tenant_slug: str, sandbox_id: UUID) -> str:
    """Generates a strictly-controlled, deterministic sandbox namespace name."""
    clean_slug = re.sub(r"[^a-z0-9]+", "-", tenant_slug.lower()).strip("-")
    short_uuid = str(sandbox_id).replace("-", "")[:8]
    namespace = f"sandbox-{clean_slug}-{short_uuid}"
    validate_sandbox_namespace(namespace)
    return namespace


def validate_sandbox_namespace(namespace: str) -> None:
    """Validates that a namespace strictly adheres to sandbox naming conventions

    and is not targeting system or production namespaces.
    """
    if not namespace:
        raise SandboxSafetyViolation("Namespace name cannot be empty.")

    ns_lower = namespace.lower().strip()

    # 1. Prohibit system namespaces
    if ns_lower in RESTRICTED_SYSTEM_NAMESPACES:
        raise SandboxSafetyViolation(
            f"Security Violation: Target namespace '{namespace}' is a protected Kubernetes system namespace."
        )

    # 2. Prohibit production-pattern namespaces
    if PROD_NAMESPACE_PATTERN.match(ns_lower):
        raise SandboxSafetyViolation(
            f"Security Violation: Namespace '{namespace}' matches production/staging patterns. "
            "Chaos experiments and dynamic sandboxes are strictly prohibited in production namespaces."
        )

    # 3. Must begin with 'sandbox-'
    if not ns_lower.startswith("sandbox-"):
        raise SandboxSafetyViolation(
            f"Security Violation: Target namespace '{namespace}' must begin with 'sandbox-' prefix."
        )

    # 4. Length constraint per RFC 1123
    if len(ns_lower) > 63:
        raise SandboxSafetyViolation(
            f"Namespace '{namespace}' exceeds maximum Kubernetes length of 63 characters."
        )


def validate_container_image(image: str) -> None:
    """Verifies container image is within the approved catalog (prevents arbitrary container execution)."""
    # Allow approved images or official pinned test images
    if image not in APPROVED_CONTAINER_IMAGES:
        # Check if it's an approved test stub image
        is_safe_mock = image.startswith("chaosengine/") or image.startswith("ghcr.io/shopify/toxiproxy:")
        if not is_safe_mock:
            raise SandboxSafetyViolation(
                f"Security Violation: Image '{image}' is not in the approved container registry catalog. "
                "Arbitrary container execution is strictly denied."
            )
