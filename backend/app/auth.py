"""Supabase JWT verification (HS256 via project JWT secret)."""

from dataclasses import dataclass
from typing import Any

import jwt
from fastapi import HTTPException, status

from app.config import Settings


@dataclass(frozen=True, slots=True)
class AuthUser:
    """Authenticated user extracted from a validated Supabase access token."""

    user_id: str
    email: str | None
    role: str | None
    raw_claims: dict[str, Any]


def verify_supabase_jwt(token: str, settings: Settings) -> AuthUser:
    """
    Validate a Supabase access token using SUPABASE_JWT_SECRET (HS256).

    Supabase free-tier projects sign user JWTs with the JWT secret from
    Project Settings → API. Claims of interest:
      - sub: auth.users.id (UUID)
      - email, role, aud ("authenticated")
    """
    if not settings.supabase_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_JWT_SECRET is not configured",
        )

    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"require": ["exp", "sub"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except jwt.InvalidAudienceError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token audience",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user_id = payload.get("sub")
    if not user_id or not isinstance(user_id, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject (sub)",
            headers={"WWW-Authenticate": "Bearer"},
        )

    email = payload.get("email")
    role = payload.get("role")
    return AuthUser(
        user_id=user_id,
        email=email if isinstance(email, str) else None,
        role=role if isinstance(role, str) else None,
        raw_claims=payload,
    )
