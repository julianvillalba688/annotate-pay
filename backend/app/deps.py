"""FastAPI dependencies: auth, settings, Supabase REST client."""

from __future__ import annotations

from datetime import date
from typing import Any
from uuid import UUID

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth import AuthUser, verify_supabase_jwt
from app.config import Settings, get_settings

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> AuthUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization Bearer token required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return verify_supabase_jwt(credentials.credentials, settings)


async def get_bearer_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization Bearer token required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.credentials


class SupabaseRestClient:
    """
    Thin PostgREST client that forwards the end-user JWT so RLS applies.

    Prefer this over the service role so row-level security enforces
    per-user isolation on task_logs / projects.
    """

    def __init__(self, settings: Settings, access_token: str) -> None:
        self._settings = settings
        self._access_token = access_token

    def _headers(self) -> dict[str, str]:
        if not self._settings.supabase_url or not self._settings.supabase_anon_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Supabase URL / anon key not configured",
            )
        return {
            "apikey": self._settings.supabase_anon_key,
            "Authorization": f"Bearer {self._access_token}",
            "Accept": "application/json",
        }

    def _filter_params(
        self,
        *,
        project_id: UUID | None,
        date_from: date | None,
        date_to: date | None,
    ) -> list[tuple[str, str]]:
        # SQL column is `date` (not work_date)
        params: list[tuple[str, str]] = []
        if project_id is not None:
            params.append(("project_id", f"eq.{project_id}"))
        if date_from is not None:
            params.append(("date", f"gte.{date_from.isoformat()}"))
        if date_to is not None:
            params.append(("date", f"lte.{date_to.isoformat()}"))
        return params

    async def fetch_task_logs(
        self,
        *,
        project_id: UUID | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[dict[str, Any]]:
        """
        GET /rest/v1/task_logs with optional filters.

        Selects common columns plus optional embedded project name.
        Falls back to a flat select if the embed is unavailable.
        """
        base = self._settings.supabase_rest_url
        filters = self._filter_params(
            project_id=project_id,
            date_from=date_from,
            date_to=date_to,
        )
        url = f"{base}/task_logs"

        embed_params = [
            ("select", "*,projects(id,name)"),
            ("order", "date.asc"),
            *filters,
        ]
        flat_params = [
            ("select", "*"),
            ("order", "date.asc"),
            *filters,
        ]

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                url, headers=self._headers(), params=embed_params
            )

            # Retry without embed if relationship name differs / missing
            if response.status_code in (300, 400, 406):
                response = await client.get(
                    url, headers=self._headers(), params=flat_params
                )

            if response.status_code == 401:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Supabase rejected the access token",
                )
            if response.status_code == 403:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Supabase RLS denied access to task_logs",
                )
            if response.status_code >= 400:
                detail = response.text[:500] if response.text else "Supabase query failed"
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Supabase error ({response.status_code}): {detail}",
                )

            data = response.json()
            if not isinstance(data, list):
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Unexpected Supabase response shape",
                )
            return data


async def get_supabase(
    token: str = Depends(get_bearer_token),
    settings: Settings = Depends(get_settings),
) -> SupabaseRestClient:
    return SupabaseRestClient(settings, token)
