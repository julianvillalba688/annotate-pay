"""Analytics aggregation endpoints."""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.auth import AuthUser
from app.deps import SupabaseRestClient, get_current_user, get_supabase
from app.models.schemas import AnalyticsSummaryResponse, GroupBy
from app.services.analytics_service import build_analytics_summary

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


@router.get("/summary", response_model=AnalyticsSummaryResponse)
async def analytics_summary(
    project_id: UUID | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    group_by: GroupBy = Query(default=GroupBy.month),
    _user: AuthUser = Depends(get_current_user),
    supabase: SupabaseRestClient = Depends(get_supabase),
) -> AnalyticsSummaryResponse:
    """
    Aggregate task_logs for the authenticated user.

    Uses snapshot AHT/rate on each log (immutable history).
    Data is fetched via the user's JWT so Supabase RLS applies.
    """
    rows = await supabase.fetch_task_logs(
        project_id=project_id,
        date_from=date_from,
        date_to=date_to,
    )
    return build_analytics_summary(rows, group_by=group_by)
