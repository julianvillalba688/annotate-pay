"""Pydantic v2 request/response models for AnnotatePay API."""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class GroupBy(str, Enum):
    month = "month"
    project = "project"


class ExportFormat(str, Enum):
    csv = "csv"
    xlsx = "xlsx"


class HealthResponse(BaseModel):
    status: str = "ok"


class TaskLogRow(BaseModel):
    """
    Snapshot row from task_logs.

    Earnings math MUST use the AHT / rate fields stored on each log
    (immutable historical snapshots). Never recompute past logs with
    current project AHT defaults.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    id: UUID | str | None = None
    user_id: UUID | str | None = None
    project_id: UUID | str | None = None
    project_name: str | None = None
    work_date: date | datetime | str | None = None
    tasks_attempter: int = 0
    tasks_reviewer: int = 0
    # Snapshot fields (authoritative for historical earnings)
    aht_attempter_seconds: float = Field(default=0, alias="aht_attempter_seconds")
    aht_reviewer_seconds: float = Field(default=0, alias="aht_reviewer_seconds")
    hourly_rate: float = 0
    hours: float | None = None
    earnings: float | None = None
    notes: str | None = None
    created_at: datetime | str | None = None


class Kpis(BaseModel):
    total_earned: float = 0
    total_tasks_attempter: int = 0
    total_tasks_reviewer: int = 0
    total_hours: float = 0


class SeriesPoint(BaseModel):
    key: str
    label: str
    earnings: float = 0
    tasks_attempter: int = 0
    tasks_reviewer: int = 0
    hours: float = 0


class AnalyticsSummaryResponse(BaseModel):
    kpis: Kpis
    series: list[SeriesPoint]


class PreviewRequest(BaseModel):
    tasks_attempter: int = Field(default=0, ge=0)
    tasks_reviewer: int = Field(default=0, ge=0)
    aht_attempter: float = Field(
        default=0,
        ge=0,
        description="AHT for attempter role in SECONDS",
    )
    aht_reviewer: float = Field(
        default=0,
        ge=0,
        description="AHT for reviewer role in SECONDS",
    )
    hourly_rate: float = Field(default=0, ge=0)


class PreviewResponse(BaseModel):
    hours: float
    earnings: float
    rate_per_task_attempter: float
    rate_per_task_reviewer: float


class ErrorResponse(BaseModel):
    detail: str


class ProjectMeta(BaseModel):
    """Optional project join fields when PostgREST embeds projects."""

    model_config = ConfigDict(extra="ignore")

    id: UUID | str | None = None
    name: str | None = None


def coerce_task_log(raw: dict[str, Any]) -> dict[str, Any]:
    """
    Normalize heterogeneous Supabase row shapes into a flat dict.

    Canonical SQL columns (20260807_initial_schema):
      date, snapshot_aht_attempter, snapshot_aht_reviewer,
      hourly_rate_used, calculated_earnings

    Also accepts alternate names used in older docs/API shapes
    (work_date, aht_*_seconds, hourly_rate, earnings).
    """
    row = dict(raw)

    # Embedded project: projects(name) or project:projects(...)
    project = row.get("projects") or row.get("project")
    if isinstance(project, dict):
        row.setdefault("project_name", project.get("name"))
        if project.get("id") is not None:
            row.setdefault("project_id", project.get("id"))

    # Date: SQL column is `date`
    if row.get("work_date") is None and row.get("date") is not None:
        row["work_date"] = row["date"]

    # Snapshot AHT (seconds) — SQL: snapshot_aht_*
    if row.get("aht_attempter_seconds") is None:
        if row.get("snapshot_aht_attempter") is not None:
            row["aht_attempter_seconds"] = row["snapshot_aht_attempter"]
        elif row.get("aht_attempter") is not None:
            row["aht_attempter_seconds"] = row["aht_attempter"]
        elif row.get("aht_attempter_secs") is not None:
            row["aht_attempter_seconds"] = row["aht_attempter_secs"]

    if row.get("aht_reviewer_seconds") is None:
        if row.get("snapshot_aht_reviewer") is not None:
            row["aht_reviewer_seconds"] = row["snapshot_aht_reviewer"]
        elif row.get("aht_reviewer") is not None:
            row["aht_reviewer_seconds"] = row["aht_reviewer"]
        elif row.get("aht_reviewer_secs") is not None:
            row["aht_reviewer_seconds"] = row["aht_reviewer_secs"]

    # Rate / earnings — SQL: hourly_rate_used, calculated_earnings
    if row.get("hourly_rate") is None and row.get("hourly_rate_used") is not None:
        row["hourly_rate"] = row["hourly_rate_used"]

    if row.get("earnings") is None and row.get("calculated_earnings") is not None:
        row["earnings"] = row["calculated_earnings"]

    for key in ("tasks_attempter", "tasks_reviewer"):
        if row.get(key) is None:
            row[key] = 0

    for key in ("aht_attempter_seconds", "aht_reviewer_seconds", "hourly_rate"):
        if row.get(key) is None:
            row[key] = 0

    return row


def to_float(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    if isinstance(value, Decimal):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def to_int(value: Any, default: int = 0) -> int:
    if value is None:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default
