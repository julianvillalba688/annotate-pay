"""Aggregation helpers for analytics summary."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from typing import Any

from app.models.schemas import (
    AnalyticsSummaryResponse,
    GroupBy,
    Kpis,
    PaymentStatus,
    SeriesPoint,
    coerce_task_log,
    to_float,
    to_int,
)
from app.services.earnings import hours_and_earnings_from_log


def _parse_work_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        # ISO date or datetime
        try:
            if "T" in text:
                return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
            return date.fromisoformat(text[:10])
        except ValueError:
            return None
    return None


def _month_key(d: date | None) -> str:
    if d is None:
        return "unknown"
    return f"{d.year:04d}-{d.month:02d}"


def _project_key(row: dict[str, Any]) -> tuple[str, str]:
    pid = row.get("project_id")
    name = row.get("project_name")
    if pid is not None:
        key = str(pid)
        label = str(name) if name else key
        return key, label
    if name:
        return str(name), str(name)
    return "unknown", "Unknown project"


def build_analytics_summary(
    rows: list[dict[str, Any]],
    group_by: GroupBy = GroupBy.month,
) -> AnalyticsSummaryResponse:
    """
    Aggregate task_log snapshots into KPIs + series.

    Always uses per-log snapshot AHT/rate (never current project defaults).
    AHT on logs is in minutes and all earnings totals are canonical USD.
    ``total_earned`` is the gross total of paid and pending earnings.
    """
    total_paid = 0.0
    total_pending = 0.0
    total_tasks_a = 0
    total_tasks_r = 0
    total_tasks_completed = 0
    total_hours = 0.0

    buckets: dict[str, dict[str, Any]] = defaultdict(
        lambda: {
            "label": "",
            "earnings": 0.0,
            "paid": 0.0,
            "pending": 0.0,
            "tasks_attempter": 0,
            "tasks_reviewer": 0,
            "hours": 0.0,
        }
    )

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

        payment_status = row["payment_status"]
        if payment_status == PaymentStatus.paid.value:
            total_paid += earnings
        else:
            total_pending += earnings
        total_tasks_a += tasks_a
        total_tasks_r += tasks_r
        total_tasks_completed += tasks_a + tasks_r
        total_hours += hours

        if group_by == GroupBy.project:
            key, label = _project_key(row)
        else:
            work_date = _parse_work_date(row.get("work_date") or row.get("created_at"))
            key = _month_key(work_date)
            label = key

        bucket = buckets[key]
        bucket["label"] = label
        bucket["earnings"] += earnings
        bucket[payment_status] += earnings
        bucket["tasks_attempter"] += tasks_a
        bucket["tasks_reviewer"] += tasks_r
        bucket["hours"] += hours

    if group_by == GroupBy.month:
        ordered_keys = sorted(k for k in buckets if k != "unknown")
        if "unknown" in buckets:
            ordered_keys.append("unknown")
    else:
        ordered_keys = sorted(
            buckets.keys(),
            key=lambda k: (-buckets[k]["earnings"], buckets[k]["label"]),
        )

    series = [
        SeriesPoint(
            key=key,
            label=str(buckets[key]["label"] or key),
            earnings=round(float(buckets[key]["earnings"]), 6),
            paid=round(float(buckets[key]["paid"]), 6),
            pending=round(float(buckets[key]["pending"]), 6),
            tasks_attempter=int(buckets[key]["tasks_attempter"]),
            tasks_reviewer=int(buckets[key]["tasks_reviewer"]),
            hours=round(float(buckets[key]["hours"]), 6),
        )
        for key in ordered_keys
    ]

    return AnalyticsSummaryResponse(
        kpis=Kpis(
            total_earned=round(total_paid + total_pending, 6),
            total_paid=round(total_paid, 6),
            total_pending=round(total_pending, 6),
            total_tasks_attempter=total_tasks_a,
            total_tasks_reviewer=total_tasks_r,
            total_tasks_completed=total_tasks_completed,
            total_hours=round(total_hours, 6),
        ),
        series=series,
    )
