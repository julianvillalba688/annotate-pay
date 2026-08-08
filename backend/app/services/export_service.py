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
    ("aht_attempter_minutes", "aht_attempter_minutes"),
    ("aht_reviewer_minutes", "aht_reviewer_minutes"),
    ("hourly_rate", "hourly_rate"),
    ("currency_code", "currency_code"),
    ("fx_rate_to_usd", "fx_rate_to_usd"),
    ("hours", "hours"),
    ("earnings_usd", "earnings_usd"),
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
    AHT columns are minutes; hourly_rate and earnings_usd are USD.
    ``calculated_earnings`` is treated as USD for rows from the initial
    migration that predate ``calculated_earnings_usd``.
    """
    out: list[dict[str, Any]] = []
    for raw in rows:
        row = coerce_task_log(raw)
        tasks_a = to_int(row.get("tasks_attempter"))
        tasks_r = to_int(row.get("tasks_reviewer"))
        aht_a = to_float(row.get("aht_attempter_minutes"))
        aht_r = to_float(row.get("aht_reviewer_minutes"))
        rate = to_float(row.get("hourly_rate"))
        stored_h = row.get("hours")
        stored_e = row.get("earnings_usd")

        hours, earnings = hours_and_earnings_from_log(
            tasks_a,
            tasks_r,
            aht_a,
            aht_r,
            rate,
            stored_hours=to_float(stored_h) if stored_h is not None else None,
            stored_earnings_usd=to_float(stored_e) if stored_e is not None else None,
            snapshot_available=bool(row.get("_has_snapshot_fields")),
        )

        # Database accounting snapshots are canonical USD. Display FX is
        # intentionally fetched at request time, never copied into exports.
        currency = "USD"
        fx_rate = 1.0
        stored_earnings_usd = (
            to_float(stored_e) if stored_e is not None else earnings
        )

        out.append(
            {
                "id": row.get("id"),
                "work_date": row.get("work_date"),
                "project_id": row.get("project_id"),
                "project_name": row.get("project_name"),
                "tasks_attempter": tasks_a,
                "tasks_reviewer": tasks_r,
                "aht_attempter_minutes": aht_a,
                "aht_reviewer_minutes": aht_r,
                "hourly_rate": rate,
                "currency_code": currency,
                "fx_rate_to_usd": fx_rate,
                "hours": round(hours, 6),
                "earnings_usd": round(stored_earnings_usd, 6),
                # Internal compatibility for callers of normalize_export_rows;
                # the downloadable schema uses the explicit USD column above.
                "earnings": round(stored_earnings_usd, 6),
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
