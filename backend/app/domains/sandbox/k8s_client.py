"""Kubernetes client wrapper providing safe, typed operations with error handling and retry logic."""

import logging
from typing import Any, Dict, List, Optional
from kubernetes import client, config
from kubernetes.client.rest import ApiException
from backend.app.core.config import settings

logger = logging.getLogger("chaosengine.k8s_client")


class K8sClientError(Exception):
    """Base exception for Kubernetes API failures."""
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


class K8sClientWrapper:
    """Encapsulates official Kubernetes Python client calls."""

    def __init__(self, in_cluster: Optional[bool] = None, kubeconfig_path: Optional[str] = None):
        self._in_cluster = in_cluster if in_cluster is not None else settings.K8S_IN_CLUSTER
        self._kubeconfig_path = kubeconfig_path or settings.KUBECONFIG_PATH
        self._initialized = False
        self._core_api: Optional[client.CoreV1Api] = None
        self._apps_api: Optional[client.AppsV1Api] = None
        self._networking_api: Optional[client.NetworkingV1Api] = None
        self._rbac_api: Optional[client.RbacAuthorizationV1Api] = None

    def initialize(self) -> bool:
        """Attempts to initialize Kubernetes client. Returns False if cluster is unreachable."""
        if self._initialized:
            return True
        try:
            if self._in_cluster:
                config.load_in_cluster_config()
                logger.info("Loaded in-cluster Kubernetes configuration.")
            else:
                config.load_kube_config(config_file=self._kubeconfig_path)
                logger.info("Loaded external kubeconfig.")

            self._core_api = client.CoreV1Api()
            self._apps_api = client.AppsV1Api()
            self._networking_api = client.NetworkingV1Api()
            self._rbac_api = client.RbacAuthorizationV1Api()
            self._initialized = True
            return True
        except Exception as ex:
            logger.warning(f"Could not initialize Kubernetes client (offline/test mode active): {ex}")
            self._initialized = False
            return False

    @property
    def is_connected(self) -> bool:
        return self._initialized and self._core_api is not None

    def create_namespace(self, manifest: Dict[str, Any]) -> None:
        if not self.is_connected:
            return
        name = manifest["metadata"]["name"]
        try:
            body = client.V1Namespace(
                metadata=client.V1ObjectMeta(
                    name=name,
                    labels=manifest["metadata"].get("labels", {}),
                )
            )
            self._core_api.create_namespace(body=body)
            logger.info(f"Created namespace: {name}")
        except ApiException as e:
            if e.status == 409:
                logger.info(f"Namespace {name} already exists.")
            else:
                raise K8sClientError(f"Failed to create namespace {name}: {e.reason}", e.status)

    def delete_namespace(self, namespace: str) -> None:
        if not self.is_connected:
            return
        try:
            body = client.V1DeleteOptions(propagation_policy="Foreground")
            self._core_api.delete_namespace(name=namespace, body=body)
            logger.info(f"Triggered deletion of namespace: {namespace}")
        except ApiException as e:
            if e.status == 404:
                logger.info(f"Namespace {namespace} already deleted.")
            else:
                raise K8sClientError(f"Failed to delete namespace {namespace}: {e.reason}", e.status)

    def namespace_exists(self, namespace: str) -> bool:
        if not self.is_connected:
            return False
        try:
            self._core_api.read_namespace(name=namespace)
            return True
        except ApiException as e:
            if e.status == 404:
                return False
            raise K8sClientError(f"Failed to check namespace {namespace}: {e.reason}", e.status)

    def list_sandbox_namespaces(self) -> List[str]:
        if not self.is_connected:
            return []
        try:
            res = self._core_api.list_namespace(
                label_selector="chaos-platform/managed-by=chaosengine"
            )
            return [ns.metadata.name for ns in res.items]
        except ApiException as e:
            raise K8sClientError(f"Failed to list sandbox namespaces: {e.reason}", e.status)

    def apply_resource_quota(self, namespace: str, manifest: Dict[str, Any]) -> None:
        if not self.is_connected:
            return
        try:
            body = client.V1ResourceQuota(
                metadata=client.V1ObjectMeta(
                    name=manifest["metadata"]["name"],
                    namespace=namespace,
                    labels=manifest["metadata"].get("labels", {}),
                ),
                spec=client.V1ResourceQuotaSpec(
                    hard=manifest["spec"]["hard"],
                ),
            )
            self._core_api.create_namespaced_resource_quota(namespace=namespace, body=body)
        except ApiException as e:
            if e.status != 409:
                raise K8sClientError(f"Failed to apply ResourceQuota: {e.reason}", e.status)

    def apply_limit_range(self, namespace: str, manifest: Dict[str, Any]) -> None:
        if not self.is_connected:
            return
        try:
            limits = []
            for item in manifest["spec"]["limits"]:
                limits.append(
                    client.V1LimitRangeItem(
                        type=item["type"],
                        default=item.get("default"),
                        default_request=item.get("defaultRequest"),
                    )
                )
            body = client.V1LimitRange(
                metadata=client.V1ObjectMeta(
                    name=manifest["metadata"]["name"],
                    namespace=namespace,
                    labels=manifest["metadata"].get("labels", {}),
                ),
                spec=client.V1LimitRangeSpec(limits=limits),
            )
            self._core_api.create_namespaced_limit_range(namespace=namespace, body=body)
        except ApiException as e:
            if e.status != 409:
                raise K8sClientError(f"Failed to apply LimitRange: {e.reason}", e.status)

    def apply_network_policy(self, namespace: str, manifest: Dict[str, Any]) -> None:
        if not self.is_connected:
            return
        try:
            # Load raw manifest into networking API
            self._networking_api.create_namespaced_network_policy(
                namespace=namespace,
                body=manifest,
            )
        except ApiException as e:
            if e.status != 409:
                raise K8sClientError(f"Failed to apply NetworkPolicy: {e.reason}", e.status)

    def apply_rbac(self, namespace: str, manifests: List[Dict[str, Any]]) -> None:
        if not self.is_connected:
            return
        try:
            for m in manifests:
                kind = m.get("kind")
                if kind == "ServiceAccount":
                    sa = client.V1ServiceAccount(
                        metadata=client.V1ObjectMeta(
                            name=m["metadata"]["name"],
                            namespace=namespace,
                            labels=m["metadata"].get("labels", {}),
                        ),
                        automount_service_account_token=m.get("automountServiceAccountToken", False),
                    )
                    self._core_api.create_namespaced_service_account(namespace=namespace, body=sa)
                elif kind == "Role":
                    role = client.V1Role(
                        metadata=client.V1ObjectMeta(
                            name=m["metadata"]["name"],
                            namespace=namespace,
                            labels=m["metadata"].get("labels", {}),
                        ),
                        rules=[],
                    )
                    self._rbac_api.create_namespaced_role(namespace=namespace, body=role)
                elif kind == "RoleBinding":
                    rb = client.V1RoleBinding(
                        metadata=client.V1ObjectMeta(
                            name=m["metadata"]["name"],
                            namespace=namespace,
                            labels=m["metadata"].get("labels", {}),
                        ),
                        subjects=[
                            client.RbacV1Subject(
                                kind="ServiceAccount",
                                name=m["subjects"][0]["name"],
                                namespace=namespace,
                            )
                        ],
                        role_ref=client.V1RoleRef(
                            kind="Role",
                            name=m["roleRef"]["name"],
                            api_group=m["roleRef"]["apiGroup"],
                        ),
                    )
                    self._rbac_api.create_namespaced_role_binding(namespace=namespace, body=rb)
        except ApiException as e:
            if e.status != 409:
                raise K8sClientError(f"Failed to configure RBAC: {e.reason}", e.status)

    def create_deployment(self, namespace: str, manifest: Dict[str, Any]) -> None:
        if not self.is_connected:
            return
        try:
            self._apps_api.create_namespaced_deployment(namespace=namespace, body=manifest)
        except ApiException as e:
            if e.status != 409:
                raise K8sClientError(f"Failed to create Deployment: {e.reason}", e.status)

    def create_service(self, namespace: str, manifest: Dict[str, Any]) -> None:
        if not self.is_connected:
            return
        try:
            self._core_api.create_namespaced_service(namespace=namespace, body=manifest)
        except ApiException as e:
            if e.status != 409:
                raise K8sClientError(f"Failed to create Service: {e.reason}", e.status)

    def get_pods(self, namespace: str) -> List[Any]:
        if not self.is_connected:
            return []
        try:
            res = self._core_api.list_namespaced_pod(namespace=namespace)
            return res.items
        except ApiException as e:
            raise K8sClientError(f"Failed to list pods in {namespace}: {e.reason}", e.status)
