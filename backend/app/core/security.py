"""Security utilities: JWT generation, validation, and Argon2id / bcrypt password hashing."""

import datetime
from typing import Any, Dict, Optional
import jwt
from backend.app.core.config import settings


def create_access_token(
    user_id: str,
    tenant_id: str,
    role: str,
    email: str,
    expires_delta: Optional[datetime.timedelta] = None,
) -> str:
    now = datetime.datetime.now(datetime.timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    payload: Dict[str, Any] = {
        "sub": user_id,
        "tenant_id": tenant_id,
        "role": role,
        "email": email,
        "iat": now,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    return jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
        options={"verify_exp": True},
    )
