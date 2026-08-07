"""Earnings preview / pure math helpers."""

from fastapi import APIRouter, Depends

from app.auth import AuthUser
from app.deps import get_current_user
from app.models.schemas import PreviewRequest, PreviewResponse
from app.services.earnings import compute_preview

router = APIRouter(prefix="/api/v1/calculations", tags=["calculations"])


@router.post("/preview", response_model=PreviewResponse)
async def preview_earnings(
    body: PreviewRequest,
    _user: AuthUser = Depends(get_current_user),
) -> PreviewResponse:
    """
    Preview hours/earnings from task counts and AHT.

    Formula:
        hours = (tasks_attempter * aht_attempter
                 + tasks_reviewer * aht_reviewer) / 3600
        earnings = hours * hourly_rate

    `aht_attempter` / `aht_reviewer` are in SECONDS.
    Auth required for consistency with other API routes.
    """
    result = compute_preview(
        tasks_attempter=body.tasks_attempter,
        tasks_reviewer=body.tasks_reviewer,
        aht_attempter_seconds=body.aht_attempter,
        aht_reviewer_seconds=body.aht_reviewer,
        hourly_rate=body.hourly_rate,
    )
    return PreviewResponse(
        hours=round(result["hours"], 8),
        earnings=round(result["earnings"], 8),
        rate_per_task_attempter=round(result["rate_per_task_attempter"], 8),
        rate_per_task_reviewer=round(result["rate_per_task_reviewer"], 8),
    )
