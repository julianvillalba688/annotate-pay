"""Task log export endpoints (CSV / Excel)."""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from app.auth import AuthUser
from app.deps import SupabaseRestClient, get_current_user, get_supabase
from app.models.schemas import ExportFormat
from app.services.export_service import build_csv, build_xlsx

router = APIRouter(prefix="/api/v1/exports", tags=["exports"])


@router.get("/task-logs")
async def export_task_logs(
    project_id: UUID | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    format: ExportFormat = Query(default=ExportFormat.csv),  # noqa: A002
    _user: AuthUser = Depends(get_current_user),
    supabase: SupabaseRestClient = Depends(get_supabase),
) -> Response:
    """
    Download task_logs as CSV or XLSX.

    Hours/earnings columns use each row's immutable snapshot AHT (minutes) and
    USD hourly rate, never current project defaults. The export exposes
    canonical ``earnings_usd`` and ``currency_code`` metadata; display
    preferences are not used to rewrite historical values.
    """
    rows = await supabase.fetch_task_logs(
        project_id=project_id,
        date_from=date_from,
        date_to=date_to,
    )

    if format == ExportFormat.xlsx:
        content = build_xlsx(rows)
        media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = "task_logs.xlsx"
    else:
        content = build_csv(rows)
        media = "text/csv; charset=utf-8"
        filename = "task_logs.csv"

    return Response(
        content=content,
        media_type=media,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
