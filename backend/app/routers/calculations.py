"""Earnings preview / pure math helpers."""

from fastapi import APIRouter, Depends

from app.auth import AuthUser
from app.deps import get_current_user
from app.models.schemas import PreviewRequest, PreviewResponse
from app.services.earnings import compute_preview
from app.services.fx import get_rate_to_usd

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
                 + tasks_reviewer * aht_reviewer) / 60
        earnings = hours * hourly_rate

    `aht_attempter` / `aht_reviewer` are in MINUTES.
    `hourly_rate` and the base earnings values are always USD. The
    backward-compatible `currency` request field selects only the display
    currency; display earnings are calculated as USD / rate_to_usd.
    Auth required for consistency with other API routes.
    """
    result = compute_preview(
        tasks_attempter=body.tasks_attempter,
        tasks_reviewer=body.tasks_reviewer,
        aht_attempter_minutes=body.aht_attempter,
        aht_reviewer_minutes=body.aht_reviewer,
        hourly_rate=body.hourly_rate,
    )

    display_currency = (body.currency or "USD").strip().upper() or "USD"
    rate_to_usd = await get_rate_to_usd(display_currency)
    earnings_usd = float(result["earnings"])
    rate_to_usd_rounded = round(rate_to_usd, 8)
    display_earnings = earnings_usd / rate_to_usd_rounded

    return PreviewResponse(
        hours=round(result["hours"], 8),
        earnings=round(earnings_usd, 8),
        rate_per_task_attempter=round(result["rate_per_task_attempter"], 8),
        rate_per_task_reviewer=round(result["rate_per_task_reviewer"], 8),
        earnings_usd=round(earnings_usd, 8),
        hourly_rate_usd=round(body.hourly_rate, 8),
        display_currency=display_currency,
        display_earnings=round(display_earnings, 8),
        rate_to_usd=rate_to_usd_rounded,
        currency=display_currency,
        fx_rate_to_usd=rate_to_usd_rounded,
    )
