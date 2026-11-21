"""FastAPI authentication and RBAC dependency injection."""

from typing import List, Optional
from uuid import UUID
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from backend.app.core.security import decode_access_token

security_bearer = HTTPBearer(auto_error=False)


class AuthContext(BaseModel):
    user_id: UUID
    tenant_id: UUID
    role: str  # TenantOwner, Engineer, Viewer
    email: str
    tenant_slug: str = "acme-corp"


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID"),
) -> AuthContext:
    """Authenticates JWT access token and extracts caller context."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials missing or invalid. Pass 'Authorization: Bearer <token>' header.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        payload = decode_access_token(token)
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {ex}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_str = payload.get("sub")
    jwt_tenant_id_str = payload.get("tenant_id")
    role = payload.get("role", "Viewer")
    email = payload.get("email", "")

    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing required 'sub' subject claim.",
        )

    # Honor X-Tenant-ID header if provided and valid, otherwise use JWT tenant_id
    active_tenant_str = x_tenant_id or jwt_tenant_id_str or "c1f7b0f6-9304-4c57-897e-d309085ec617"

    try:
        user_id = UUID(str(user_id_str))
        tenant_id = UUID(str(active_tenant_str))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UUID format for user_id or tenant_id.",
        )

    # Derive clean tenant slug
    slug = email.split("@")[-1].split(".")[0] if "@" in email else "tenant"

    return AuthContext(
        user_id=user_id,
        tenant_id=tenant_id,
        role=role,
        email=email,
        tenant_slug=slug,
    )


def require_roles(allowed_roles: List[str]):
    """Enforces role-based access control. Rejects unauthorized roles with 403 Forbidden."""

    def role_checker(auth: AuthContext = Depends(get_current_user)) -> AuthContext:
        if auth.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access Denied: Your role [{auth.role}] lacks required permission. "
                    f"Allowed roles: {allowed_roles}."
                ),
            )
        return auth

    return role_checker


# Role-based dependency shortcuts
require_sandbox_operator = require_roles(["TenantOwner", "Engineer"])
require_sandbox_viewer = require_roles(["TenantOwner", "Engineer", "Viewer"])
