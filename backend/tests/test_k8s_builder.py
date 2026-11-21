"""Unit tests for Kubernetes manifest builder."""

from uuid import uuid4
import pytest
from backend.app.domains.sandbox.k8s_builder import K8sManifestBuilder
from backend.app.domains.sandbox.models import ResourceProfile
from backend.app.domains.sandbox.safety import SandboxSafetyViolation


def test_build_namespace_labels_and_pss():
    tenant_id = uuid4()
    sandbox_id = uuid4()
    project_id = uuid4()
    ns_name = f"sandbox-acme-{str(sandbox_id)[:8]}"

    manifest = K8sManifestBuilder.build_namespace(
        namespace=ns_name,
        tenant_id=tenant_id,
        sandbox_id=sandbox_id,
        project_id=project_id,
    )

    assert manifest["apiVersion"] == "v1"
    assert manifest["kind"] == "Namespace"
    assert manifest["metadata"]["name"] == ns_name
    labels = manifest["metadata"]["labels"]
    assert labels["chaos-platform/tenant-id"] == str(tenant_id)
    assert labels["chaos-platform/sandbox-id"] == str(sandbox_id)
    assert labels["chaos-platform/project-id"] == str(project_id)
    assert labels["pod-security.kubernetes.io/enforce"] == "baseline"


def test_build_resource_quota():
    profile = ResourceProfile(
        cpu_request="4",
        cpu_limit="8",
        memory_request="8Gi",
        memory_limit="16Gi",
        max_pods=25,
    )
    manifest = K8sManifestBuilder.build_resource_quota("sandbox-test", profile)

    assert manifest["kind"] == "ResourceQuota"
    hard = manifest["spec"]["hard"]
    assert hard["requests.cpu"] == "4"
    assert hard["limits.cpu"] == "8"
    assert hard["requests.memory"] == "8Gi"
    assert hard["limits.memory"] == "16Gi"
    assert hard["pods"] == "25"


def test_build_network_policy_default_deny_and_whitelist():
    sandbox_id = uuid4()
    manifest = K8sManifestBuilder.build_network_policy("sandbox-test", sandbox_id)

    assert manifest["kind"] == "NetworkPolicy"
    spec = manifest["spec"]
    assert spec["policyTypes"] == ["Ingress", "Egress"]

    # Ingress checks
    ingress_rules = spec["ingress"]
    assert len(ingress_rules) == 2  # Intra-pod + control plane on 8474
    assert ingress_rules[1]["ports"][0]["port"] == 8474

    # Egress checks
    egress_rules = spec["egress"]
    assert len(egress_rules) == 3  # Intra-pod + DNS (port 53) + OTel (port 4317)
    dns_ports = [p["port"] for p in egress_rules[1]["ports"]]
    assert 53 in dns_ports
    assert egress_rules[2]["ports"][0]["port"] == 4317


def test_build_service_deployment_injects_toxiproxy():
    sandbox_id = uuid4()
    dep = K8sManifestBuilder.build_service_deployment(
        namespace="sandbox-test",
        sandbox_id=sandbox_id,
        service_name="payment-service",
        image="chaosengine/payment-service:1.0.0",
        replicas=1,
    )

    assert dep["kind"] == "Deployment"
    spec = dep["spec"]["template"]["spec"]
    assert spec["serviceAccountName"] == "sandbox-workload-runner"
    containers = spec["containers"]
    assert len(containers) == 2

    app_container = next(c for c in containers if c["name"] == "app")
    assert app_container["image"] == "chaosengine/payment-service:1.0.0"
    assert app_container["ports"][0]["containerPort"] == 8081

    toxi_container = next(c for c in containers if c["name"] == "toxiproxy-sidecar")
    assert toxi_container["image"] == "ghcr.io/shopify/toxiproxy:2.9.0"
    toxi_ports = [p["containerPort"] for p in toxi_container["ports"]]
    assert 8080 in toxi_ports  # proxy ingress
    assert 8474 in toxi_ports  # management API


def test_build_service_deployment_rejects_unapproved_image():
    sandbox_id = uuid4()
    with pytest.raises(SandboxSafetyViolation):
        K8sManifestBuilder.build_service_deployment(
            namespace="sandbox-test",
            sandbox_id=sandbox_id,
            service_name="malicious-service",
            image="evil-registry.io/backdoor:latest",
        )
