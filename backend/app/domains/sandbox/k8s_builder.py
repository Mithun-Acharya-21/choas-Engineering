"""Pure functional builder for tenant-isolated Kubernetes manifests."""

from typing import Any, Dict, List
from uuid import UUID
from backend.app.domains.sandbox.models import ResourceProfile
from backend.app.domains.sandbox.safety import validate_container_image, validate_sandbox_namespace


class K8sManifestBuilder:
    """Builds valid Kubernetes objects (as Python dicts compatible with kubernetes Python client

    and YAML serializers) implementing zero-trust multi-tenant isolation.
    """

    @staticmethod
    def build_namespace(
        namespace: str,
        tenant_id: UUID,
        sandbox_id: UUID,
        project_id: UUID,
    ) -> Dict[str, Any]:
        validate_sandbox_namespace(namespace)
        return {
            "apiVersion": "v1",
            "kind": "Namespace",
            "metadata": {
                "name": namespace,
                "labels": {
                    "chaos-platform/managed-by": "chaosengine",
                    "chaos-platform/tenant-id": str(tenant_id),
                    "chaos-platform/sandbox-id": str(sandbox_id),
                    "chaos-platform/project-id": str(project_id),
                    "pod-security.kubernetes.io/enforce": "baseline",
                    "pod-security.kubernetes.io/audit": "restricted",
                },
            },
        }

    @staticmethod
    def build_resource_quota(namespace: str, profile: ResourceProfile) -> Dict[str, Any]:
        return {
            "apiVersion": "v1",
            "kind": "ResourceQuota",
            "metadata": {
                "name": "sandbox-quota",
                "namespace": namespace,
                "labels": {
                    "chaos-platform/managed-by": "chaosengine",
                },
            },
            "spec": {
                "hard": {
                    "requests.cpu": profile.cpu_request,
                    "limits.cpu": profile.cpu_limit,
                    "requests.memory": profile.memory_request,
                    "limits.memory": profile.memory_limit,
                    "pods": str(profile.max_pods),
                }
            },
        }

    @staticmethod
    def build_limit_range(namespace: str) -> Dict[str, Any]:
        return {
            "apiVersion": "v1",
            "kind": "LimitRange",
            "metadata": {
                "name": "sandbox-limits",
                "namespace": namespace,
                "labels": {
                    "chaos-platform/managed-by": "chaosengine",
                },
            },
            "spec": {
                "limits": [
                    {
                        "type": "Container",
                        "default": {
                            "cpu": "500m",
                            "memory": "512Mi",
                        },
                        "defaultRequest": {
                            "cpu": "100m",
                            "memory": "128Mi",
                        },
                    }
                ]
            },
        }

    @staticmethod
    def build_network_policy(namespace: str, sandbox_id: UUID) -> Dict[str, Any]:
        """Builds default-deny network policy with explicit whitelist:

        - Ingress: intra-sandbox pods + control plane Celery workers on port 8474 (Toxiproxy mgmt)
        - Egress: intra-sandbox pods + DNS (port 53) + OTLP Collector (port 4317)
        All cross-namespace and internet egress is blocked.
        """
        return {
            "apiVersion": "networking.k8s.io/v1",
            "kind": "NetworkPolicy",
            "metadata": {
                "name": "default-deny-isolate",
                "namespace": namespace,
                "labels": {
                    "chaos-platform/managed-by": "chaosengine",
                    "chaos-platform/sandbox-id": str(sandbox_id),
                },
            },
            "spec": {
                "podSelector": {},
                "policyTypes": ["Ingress", "Egress"],
                "ingress": [
                    # 1. Allow intra-namespace microservice traffic
                    {
                        "from": [
                            {
                                "podSelector": {},
                            }
                        ]
                    },
                    # 2. Allow control plane Celery workers to reach Toxiproxy management API on port 8474
                    {
                        "from": [
                            {
                                "namespaceSelector": {
                                    "matchLabels": {
                                        "kubernetes.io/metadata.name": "chaos-control-plane",
                                    }
                                }
                            }
                        ],
                        "ports": [
                            {"protocol": "TCP", "port": 8474},
                        ],
                    },
                ],
                "egress": [
                    # 1. Allow intra-namespace sibling pod communication
                    {
                        "to": [
                            {
                                "podSelector": {},
                            }
                        ]
                    },
                    # 2. Allow CoreDNS resolution
                    {
                        "to": [
                            {
                                "namespaceSelector": {
                                    "matchLabels": {
                                        "kubernetes.io/metadata.name": "kube-system",
                                    }
                                }
                            }
                        ],
                        "ports": [
                            {"protocol": "UDP", "port": 53},
                            {"protocol": "TCP", "port": 53},
                        ],
                    },
                    # 3. Allow OpenTelemetry trace & metric export to OTel collector on port 4317
                    {
                        "to": [
                            {
                                "namespaceSelector": {
                                    "matchLabels": {
                                        "kubernetes.io/metadata.name": "chaos-control-plane",
                                    }
                                }
                            }
                        ],
                        "ports": [
                            {"protocol": "TCP", "port": 4317},
                        ],
                    },
                ],
            },
        }

    @staticmethod
    def build_rbac_service_account(namespace: str) -> List[Dict[str, Any]]:
        """Namespace-scoped unprivileged ServiceAccount, Role, and RoleBinding."""
        sa_name = "sandbox-workload-runner"
        return [
            {
                "apiVersion": "v1",
                "kind": "ServiceAccount",
                "metadata": {
                    "name": sa_name,
                    "namespace": namespace,
                    "labels": {"chaos-platform/managed-by": "chaosengine"},
                },
                "automountServiceAccountToken": False,  # Block access to K8s API token by default!
            },
            {
                "apiVersion": "rbac.authorization.k8s.io/v1",
                "kind": "Role",
                "metadata": {
                    "name": "sandbox-unprivileged-role",
                    "namespace": namespace,
                    "labels": {"chaos-platform/managed-by": "chaosengine"},
                },
                "rules": [],  # Strictly zero privileges against Kubernetes API server
            },
            {
                "apiVersion": "rbac.authorization.k8s.io/v1",
                "kind": "RoleBinding",
                "metadata": {
                    "name": "sandbox-unprivileged-binding",
                    "namespace": namespace,
                    "labels": {"chaos-platform/managed-by": "chaosengine"},
                },
                "subjects": [
                    {
                        "kind": "ServiceAccount",
                        "name": sa_name,
                        "namespace": namespace,
                    }
                ],
                "roleRef": {
                    "kind": "Role",
                    "name": "sandbox-unprivileged-role",
                    "apiGroup": "rbac.authorization.k8s.io",
                },
            },
        ]

    @staticmethod
    def build_service_deployment(
        namespace: str,
        sandbox_id: UUID,
        service_name: str,
        image: str,
        replicas: int = 1,
    ) -> Dict[str, Any]:
        """Builds a microservice Deployment with injected Toxiproxy sidecar."""
        validate_container_image(image)
        labels = {
            "app.kubernetes.io/name": service_name,
            "chaos-platform/sandbox-id": str(sandbox_id),
            "chaos-platform/service": service_name,
        }

        return {
            "apiVersion": "apps/v1",
            "kind": "Deployment",
            "metadata": {
                "name": service_name,
                "namespace": namespace,
                "labels": labels,
            },
            "spec": {
                "replicas": replicas,
                "selector": {
                    "matchLabels": labels,
                },
                "template": {
                    "metadata": {
                        "labels": labels,
                    },
                    "spec": {
                        "serviceAccountName": "sandbox-workload-runner",
                        "containers": [
                            # Container 1: The application microservice
                            {
                                "name": "app",
                                "image": image,
                                "ports": [
                                    {"containerPort": 8081, "name": "app-internal"}
                                ],
                                "env": [
                                    {"name": "PORT", "value": "8081"},
                                    {"name": "SERVICE_NAME", "value": service_name},
                                    {"name": "SANDBOX_ID", "value": str(sandbox_id)},
                                ],
                                "resources": {
                                    "requests": {"cpu": "50m", "memory": "64Mi"},
                                    "limits": {"cpu": "200m", "memory": "256Mi"},
                                },
                            },
                            # Container 2: Injected Toxiproxy TCP Proxy Sidecar
                            {
                                "name": "toxiproxy-sidecar",
                                "image": "ghcr.io/shopify/toxiproxy:2.9.0",
                                "args": [
                                    "-host=0.0.0.0",
                                    "-proxy-host=0.0.0.0",
                                ],
                                "ports": [
                                    {"containerPort": 8080, "name": "proxy-ingress"},
                                    {"containerPort": 8474, "name": "toxi-mgmt"},
                                ],
                                "resources": {
                                    "requests": {"cpu": "25m", "memory": "32Mi"},
                                    "limits": {"cpu": "100m", "memory": "128Mi"},
                                },
                            },
                        ],
                    },
                },
            },
        }

    @staticmethod
    def build_service_cluster_ip(namespace: str, service_name: str) -> Dict[str, Any]:
        """Builds Kubernetes ClusterIP Service routing port 8080 to the Toxiproxy proxy ingress."""
        return {
            "apiVersion": "v1",
            "kind": "Service",
            "metadata": {
                "name": service_name,
                "namespace": namespace,
                "labels": {
                    "app.kubernetes.io/name": service_name,
                    "chaos-platform/service": service_name,
                },
            },
            "spec": {
                "type": "ClusterIP",
                "selector": {
                    "app.kubernetes.io/name": service_name,
                },
                "ports": [
                    {
                        "name": "http-ingress",
                        "port": 8080,
                        "targetPort": 8080,
                        "protocol": "TCP",
                    },
                    {
                        "name": "toxi-mgmt",
                        "port": 8474,
                        "targetPort": 8474,
                        "protocol": "TCP",
                    },
                ],
            },
        }
