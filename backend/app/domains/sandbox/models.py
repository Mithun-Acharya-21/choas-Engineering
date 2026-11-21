"""Domain models and schemas for Kubernetes Sandboxes."""

import enum
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4
from pydantic import BaseModel, Field


class SandboxLifecycleState(str, enum.Enum):
    PENDING = "PENDING"
    PROVISIONING = "PROVISIONING"
    READY = "READY"
    FAILED = "FAILED"
    TERMINATING = "TERMINATING"
    TERMINATED = "TERMINATED"


class ContainerStatus(BaseModel):
    name: str
    ready: bool = False
    restart_count: int = 0
    image: str


class K8sPodStatus(BaseModel):
    name: str
    namespace: str
    status: str = "Pending"  # Running, Pending, Failed, etc.
    ready_containers: str = "0/0"
    restart_count: int = 0
    toxiproxy_active: bool = False
    ip: Optional[str] = None
    node_name: Optional[str] = None
    containers: List[ContainerStatus] = Field(default_factory=list)


class K8sWorkloadStatus(BaseModel):
    name: str
    namespace: str
    replicas_desired: int = 1
    replicas_ready: int = 0
    image: str
    container_port: int = 8081
    toxiproxy_port: int = 8080
    endpoint: str = ""
    pods: List[K8sPodStatus] = Field(default_factory=list)


class ResourceProfile(BaseModel):
    profile_name: str = "standard"  # standard, high_memory, stress_lab
    cpu_request: str = "2"
    cpu_limit: str = "4"
    memory_request: str = "4Gi"
    memory_limit: str = "8Gi"
    max_pods: int = 20


class SandboxCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=64, description="Human-readable sandbox name")
    project_id: UUID = Field(..., description="Project scoping boundary")
    cluster_id: str = Field(default="sandbox-alpha-us-east-1")
    topology_id: Optional[UUID] = None
    resource_profile: ResourceProfile = Field(default_factory=ResourceProfile)
    ttl_hours: int = Field(default=4, ge=1, le=24, description="Auto-teardown time to live in hours")


class SandboxRecord(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    tenant_id: UUID
    project_id: UUID
    name: str
    k8s_namespace: str
    cluster_id: str
    topology_id: Optional[UUID] = None
    resource_profile: ResourceProfile
    status: SandboxLifecycleState = SandboxLifecycleState.PENDING
    idempotency_key: Optional[str] = None
    workloads: List[K8sWorkloadStatus] = Field(default_factory=list)
    is_isolated: bool = False  # Set to true when default-deny NetworkPolicy is applied
    error_summary: Optional[str] = None
    expires_at: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SandboxStatusResponse(BaseModel):
    id: UUID
    status: SandboxLifecycleState
    k8s_namespace: str
    cluster_id: str
    progress_percentage: int
    current_step: str
    workloads_ready: int
    workloads_total: int
    error_summary: Optional[str] = None
    updated_at: datetime


class SandboxListResponse(BaseModel):
    items: List[SandboxRecord]
    total: int


class SandboxTerminateResponse(BaseModel):
    id: UUID
    status: SandboxLifecycleState
    k8s_namespace: str
    message: str


class AuditLogRecord(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    tenant_id: UUID
    user_id: Optional[UUID] = None
    action: str  # e.g., SANDBOX_PROVISIONED, SANDBOX_TERMINATED
    resource_type: str = "SANDBOX"
    resource_id: UUID
    client_ip: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
