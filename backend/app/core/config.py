"""Global configuration for ChaosEngine AI backend."""

from typing import List, Optional
from pydantic import ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "ChaosEngine AI Backend"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False

    # Security & Auth
    JWT_SECRET_KEY: str = "chaos-engine-dev-insecure-secret-key-change-in-prod-0987654321"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Multi-Tenant & RBAC Defaults
    DEFAULT_CLUSTER_ID: str = "sandbox-alpha-us-east-1"
    ALLOWED_CLUSTERS: List[str] = [
        "sandbox-alpha-us-east-1",
        "sandbox-beta-eu-central-1",
        "sandbox-dev-local-kind",
    ]

    # Kubernetes Settings
    K8S_IN_CLUSTER: bool = False
    KUBECONFIG_PATH: Optional[str] = None
    K8S_PROVISIONING_TIMEOUT_SECONDS: int = 300
    K8S_NAMESPACE_PREFIX: str = "sandbox-"

    # Sandbox Quota Defaults
    DEFAULT_QUOTA_CPU_REQUEST: str = "2"
    DEFAULT_QUOTA_CPU_LIMIT: str = "4"
    DEFAULT_QUOTA_MEMORY_REQUEST: str = "4Gi"
    DEFAULT_QUOTA_MEMORY_LIMIT: str = "8Gi"
    DEFAULT_QUOTA_MAX_PODS: int = 20

    # LLM & AI Postmortem Configuration (Milestone M9)
    LLM_PROVIDER: str = "mock"  # "mock", "groq", "openai"
    LLM_MODEL: str = "llama-3.3-70b-versatile"
    LLM_TIMEOUT_SECONDS: int = 15
    LLM_TEMPERATURE: float = 0.1
    LLM_MAX_TOKENS: int = 2048
    GROQ_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


settings = Settings()
