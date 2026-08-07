"""CSV / Excel export builders for task logs."""

from __future__ import annotations

import csv
import io
from datetime import date, datetime
from typing import Any

from openpyxl import Workbook

from app.models.schemas import coerce_task_log, to_float, to_int
from app.services.earnings import hours_and_earnings_from_log

EXPORT_COLUMNS: list[tuple[str, str]] = [
    ("id", "id"),
    ("work_date", "work_date"),
    ("project_id", "project_id"),
    ("project_name", "project_name"),
    ("tasks_attempter", "tasks_attempter"),
    ("tasks_reviewer", "tasks_reviewer"),
    ("aht_attempter_seconds", "aht_attempter_seconds"),
    ("aht_reviewer_seconds", "aht_reviewer_seconds"),
    ("hourly_rate", "hourly_rate"),
    ("hours", "hours"),
    ("earnings", "earnings"),
    ("notes", "notes"),
    ("created_at", "created_at"),
]


def _stringify(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def normalize_export_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Flatten logs and attach hours/earnings from snapshot fields.

    Never overwrites snapshot AHT/rate with current project defaults.
    """
    out: list[dict[str, Any]] = []
    for raw in rows:
        row = coerce_task_log(raw)
        tasks_a = to_int(row.get("tasks_attempter"))
        tasks_r = to_int(row.get("tasks_reviewer"))
        aht_a = to_float(row.get("aht_attempter_seconds"))
        aht_r = to_float(row.get("aht_reviewer_seconds"))
        rate = to_float(row.get("hourly_rate"))
        stored_h = row.get("hours")
        stored_e = row.get("earnings")

        hours, earnings = hours_and_earnings_from_log(
            tasks_a,
            tasks_r,
            aht_a,
            aht_r,
            rate,
            stored_hours=to_float(stored_h) if stored_h is not None else None,
            stored_earnings=to_float(stored_e) if stored_e is not None else None,
        )

        out.append(
            {
                "id": row.get("id"),
                "work_date": row.get("work_date"),
                "project_id": row.get("project_id"),
                "project_name": row.get("project_name"),
                "tasks_attempter": tasks_a,
                "tasks_reviewer": tasks_r,
                "aht_attempter_seconds": aht_a,
                "aht_reviewer_seconds": aht_r,
                "hourly_rate": rate,
                "hours": round(hours, 6),
                "earnings": round(earnings, 6),
                "notes": row.get("notes"),
                "created_at": row.get("created_at"),
            }
        )
    return out


def build_csv(rows: list[dict[str, Any]]) -> bytes:
    normalized = normalize_export_rows(rows)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([header for _, header in EXPORT_COLUMNS])
    for row in normalized:
        writer.writerow([_stringify(row.get(key)) for key, _ in EXPORT_COLUMNS])
    return buffer.getvalue().encode("utf-8-sig")


def build_xlsx(rows: list[dict[str, Any]]) -> bytes:
    normalized = normalize_export_rows(rows)
    wb = Workbook()
    ws = wb.active
    ws.title = "task_logs"
    ws.append([header for _, header in EXPORT_COLUMNS])
    for row in normalized:
        ws.append([row.get(key) for key, _ in EXPORT_COLUMNS])

    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()
