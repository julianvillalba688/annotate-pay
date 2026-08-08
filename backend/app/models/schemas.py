"""Pydantic v2 request/response models for AnnotatePay API."""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


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

    AHT fields are in MINUTES and hourly_rate/earnings are canonical USD.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    id: UUID | str | None = None
    user_id: UUID | str | None = None
    project_id: UUID | str | None = None
    project_name: str | None = None
    work_date: date | datetime | str | None = Field(
        default=None,
        validation_alias=AliasChoices("work_date", "date"),
    )
    tasks_attempter: int = 0
    tasks_reviewer: int = 0
    # Snapshot fields (authoritative for historical earnings) — minutes
    aht_attempter_minutes: float = Field(
        default=0,
        validation_alias=AliasChoices(
            "aht_attempter_minutes", "snapshot_aht_attempter"
        ),
        description="Immutable attempter AHT snapshot in minutes",
    )
    aht_reviewer_minutes: float = Field(
        default=0,
        validation_alias=AliasChoices(
            "aht_reviewer_minutes", "snapshot_aht_reviewer"
        ),
        description="Immutable reviewer AHT snapshot in minutes",
    )
    hourly_rate: float = Field(
        default=0,
        validation_alias=AliasChoices("hourly_rate", "hourly_rate_used"),
        description="Immutable canonical USD hourly-rate snapshot",
    )
    currency_code: str = Field(
        default="USD",
        description="Canonical accounting currency; currently always USD",
    )
    fx_rate_to_usd: float = Field(
        default=1.0,
        description="Accounting FX snapshot; canonical USD rows use 1",
    )
    hours: float | None = None
    earnings_usd: float | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "earnings_usd",
            "calculated_earnings_usd",
            "calculated_earnings",
        ),
        description="Immutable canonical USD earnings snapshot",
    )
    # Kept for callers that still construct this internal model directly.
    earnings: float | None = None
    notes: str | None = None
    created_at: datetime | str | None = None


class Kpis(BaseModel):
    """Analytics KPIs. ``total_earned`` is always canonical USD."""

    total_earned: float = 0
    total_tasks_attempter: int = 0
    total_tasks_reviewer: int = 0
    total_hours: float = 0


class SeriesPoint(BaseModel):
    """Analytics series point. ``earnings`` is always canonical USD."""

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
        description="AHT for attempter role in MINUTES",
    )
    aht_reviewer: float = Field(
        default=0,
        ge=0,
        description="AHT for reviewer role in MINUTES",
    )
    hourly_rate: float = Field(default=0, ge=0)
    currency: str | None = Field(
        default=None,
        description=(
            "Backward-compatible desired display currency; accounting remains USD"
        ),
    )


class PreviewResponse(BaseModel):
    """Preview with canonical USD values plus an optional display conversion."""

    hours: float
    # ``earnings`` and the per-task rates are retained for API compatibility;
    # all three values are USD.
    earnings: float = Field(description="Canonical USD earnings")
    rate_per_task_attempter: float = Field(
        description="Canonical USD earnings for one attempter task"
    )
    rate_per_task_reviewer: float = Field(
        description="Canonical USD earnings for one reviewer task"
    )
    earnings_usd: float = Field(description="Canonical USD earnings")
    hourly_rate_usd: float = Field(description="Canonical USD hourly rate")
    display_currency: str = Field(description="Requested display currency")
    display_earnings: float = Field(
        description="Earnings converted from USD to display_currency"
    )
    rate_to_usd: float = Field(
        description="USD value of one unit of display_currency"
    )
    # Backward-compatible response names. They describe the display conversion,
    # not the currency of the canonical earnings fields above.
    currency: str = Field(
        default="USD",
        description="Compatibility name for display_currency",
    )
    fx_rate_to_usd: float = Field(
        default=1.0,
        description="Compatibility name for rate_to_usd",
    )


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

    The current SQL migration exposes these immutable snapshot columns:
      snapshot_aht_attempter, snapshot_aht_reviewer (minutes)
      hourly_rate_used (USD)
      calculated_earnings_usd (USD)

    The follow-up migration converts the initial schema's seconds values once
    and records ``app_meta.aht_unit = minutes``. This function therefore only
    accepts the converted SQL snapshot names (or the already-normalized minute
    names). It deliberately does not guess whether arbitrary legacy AHT names
    contain seconds or minutes.

    ``calculated_earnings`` is accepted as a USD fallback for rows created
    before ``calculated_earnings_usd`` was added. ``currency_code`` and
    ``fx_rate_to_usd`` are accounting metadata; a display preference is never
    used as a replacement for historical USD earnings.
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

    # The post-migration SQL snapshot fields are already in minutes.
    has_aht_snapshot = (
        row.get("aht_attempter_minutes") is not None
        or row.get("aht_reviewer_minutes") is not None
        or row.get("snapshot_aht_attempter") is not None
        or row.get("snapshot_aht_reviewer") is not None
    )
    if row.get("aht_attempter_minutes") is None:
        if row.get("snapshot_aht_attempter") is not None:
            row["aht_attempter_minutes"] = row["snapshot_aht_attempter"]

    if row.get("aht_reviewer_minutes") is None:
        if row.get("snapshot_aht_reviewer") is not None:
            row["aht_reviewer_minutes"] = row["snapshot_aht_reviewer"]

    # Rate / earnings: SQL names are immutable USD snapshots.
    if row.get("hourly_rate") is None and row.get("hourly_rate_used") is not None:
        row["hourly_rate"] = row["hourly_rate_used"]

    if row.get("earnings_usd") is None:
        if row.get("calculated_earnings_usd") is not None:
            row["earnings_usd"] = row["calculated_earnings_usd"]
        elif row.get("calculated_earnings") is not None:
            # Existing rows from the initial schema are canonical USD.
            row["earnings_usd"] = row["calculated_earnings"]
        elif row.get("earnings") is not None:
            row["earnings_usd"] = row["earnings"]

    if row.get("earnings") is None and row.get("earnings_usd") is not None:
        row["earnings"] = row["earnings_usd"]

    # These are added by the follow-up migration. Its trigger forces USD/1 on
    # every insert, so a display currency can never relabel stored earnings.
    row["currency_code"] = "USD"
    row["fx_rate_to_usd"] = 1.0

    for key in ("tasks_attempter", "tasks_reviewer"):
        if row.get(key) is None:
            row[key] = 0

    for key in ("aht_attempter_minutes", "aht_reviewer_minutes", "hourly_rate"):
        if row.get(key) is None:
            row[key] = 0

    # Consumers can distinguish a malformed/partial row from a valid zero-AHT
    # snapshot and safely fall back to stored USD values in the former case.
    row["_has_snapshot_fields"] = has_aht_snapshot or (
        raw.get("hourly_rate") is not None
        or raw.get("hourly_rate_used") is not None
    )

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
