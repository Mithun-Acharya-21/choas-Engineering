"""Domain models for microservice topology editor, validation, versioning, and deployment."""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4
from pydantic import BaseModel, ConfigDict, Field


class NodeType(str, Enum):
    API_GATEWAY = "api_gateway"
    APP_SERVICE = "app_service"
    POSTGRES = "postgres"
    REDIS = "redis"
    EXTERNAL = "external"


class ProtocolType(str, Enum):
    HTTP = "HTTP"
    GRPC = "gRPC"
    AMQP = "AMQP"
    TCP = "TCP"


class DependencyType(str, Enum):
    SYNCHRONOUS = "synchronous"
    ASYNCHRONOUS = "asynchronous"


class NodePosition(BaseModel):
    x: float
    y: float


class ResourceLimits(BaseModel):
    cpu_request: str = "100m"
    cpu_limit: str = "500m"
    memory_request: str = "128Mi"
    memory_limit: str = "512Mi"


class HealthCheck(BaseModel):
    path: str = "/health"
    port: int = 8081
    initial_delay_seconds: int = 5
    period_seconds: int = 10


class TopologyNode(BaseModel):
    id: str = Field(..., description="Unique node ID in the graph, RFC 1123 compliant")
    name: str = Field(..., description="Human-readable service name")
    node_type: NodeType = NodeType.APP_SERVICE
    image: str = Field(..., description="Approved container image")
    container_port: int = Field(default=8081)
    replicas: int = Field(default=1)
    env_vars: Dict[str, str] = Field(default_factory=dict, description="Configuration references (no secrets)")
    resource_limits: ResourceLimits = Field(default_factory=ResourceLimits)
    health_check: Optional[HealthCheck] = Field(default_factory=HealthCheck)
    position: NodePosition = Field(default_factory=lambda: NodePosition(x=100.0, y=100.0))
    group_id: Optional[str] = None
    description: Optional[str] = None


class TopologyEdge(BaseModel):
    id: str = Field(..., description="Unique edge identifier")
    source: str = Field(..., description="Source node ID")
    target: str = Field(..., description="Target node ID")
    protocol: ProtocolType = ProtocolType.HTTP
    dependency_type: DependencyType = DependencyType.SYNCHRONOUS
    port: Optional[int] = Field(default=None)
    description: Optional[str] = None


class TopologyGroup(BaseModel):
    id: str
    name: str
    color: Optional[str] = "#6366f1"


class TopologyCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    project_id: UUID
    description: Optional[str] = None
    nodes: List[TopologyNode] = Field(default_factory=list)
    edges: List[TopologyEdge] = Field(default_factory=list)
    groups: List[TopologyGroup] = Field(default_factory=list)


class TopologyUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    expected_version: int = Field(..., description="Optimistic concurrency control version check")
    nodes: List[TopologyNode]
    edges: List[TopologyEdge]
    groups: List[TopologyGroup] = Field(default_factory=list)


class TopologyRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    project_id: UUID
    name: str
    description: Optional[str] = None
    version: int = 1
    nodes: List[TopologyNode] = Field(default_factory=list)
    edges: List[TopologyEdge] = Field(default_factory=list)
    groups: List[TopologyGroup] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID] = None


class TopologyVersionRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    topology_id: UUID
    version: int
    name: str
    nodes: List[TopologyNode]
    edges: List[TopologyEdge]
    groups: List[TopologyGroup]
    created_at: datetime
    created_by: Optional[UUID] = None


class ValidationErrorDetail(BaseModel):
    code: str
    message: str
    node_id: Optional[str] = None
    edge_id: Optional[str] = None


class ValidationWarningDetail(BaseModel):
    code: str
    message: str
    cycle: Optional[List[str]] = None
    node_id: Optional[str] = None


class TopologyValidationResult(BaseModel):
    is_valid: bool
    errors: List[ValidationErrorDetail] = Field(default_factory=list)
    warnings: List[ValidationWarningDetail] = Field(default_factory=list)
    detected_cycles: List[List[str]] = Field(default_factory=list)
    node_count: int = 0
    edge_count: int = 0


class TopologyDeployRequest(BaseModel):
    sandbox_id: UUID


class TopologyDeployResponse(BaseModel):
    sandbox_id: UUID
    topology_id: UUID
    topology_version: int
    status: str
    workloads_deployed: int
    namespace: str
    message: str
    deployed_at: datetime
