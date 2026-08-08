"""
Pure earnings math for AnnotatePay.

Authoritative formula (document & enforce everywhere):

    hours = (tasks_attempter * aht_attempter_minutes
             + tasks_reviewer * aht_reviewer_minutes) / 60
    earnings = hours * hourly_rate
    rate_per_task = (aht_minutes / 60) * hourly_rate

Notes:
- AHT values are in MINUTES.
- Zero tasks are allowed for either role.
- Historical snapshots are immutable: when aggregating/exporting logs,
  always use the AHT and hourly_rate stored on each log row — never
  "fix" past logs with current project defaults.
"""

from __future__ import annotations


def compute_hours(
    tasks_attempter: int | float,
    tasks_reviewer: int | float,
    aht_attempter_minutes: float,
    aht_reviewer_minutes: float,
) -> float:
    """Return total hours from task counts and AHT (minutes)."""
    total_minutes = (
        float(tasks_attempter) * float(aht_attempter_minutes)
        + float(tasks_reviewer) * float(aht_reviewer_minutes)
    )
    return total_minutes / 60.0


def compute_earnings(hours: float, hourly_rate: float) -> float:
    """Return earnings = hours * hourly_rate."""
    return float(hours) * float(hourly_rate)


def rate_per_task(aht_minutes: float, hourly_rate: float) -> float:
    """
    Effective $ per single task for a role.

        rate_per_task = (aht_minutes / 60) * hourly_rate
    """
    return (float(aht_minutes) / 60.0) * float(hourly_rate)


def compute_preview(
    tasks_attempter: int | float,
    tasks_reviewer: int | float,
    aht_attempter_minutes: float,
    aht_reviewer_minutes: float,
    hourly_rate: float,
) -> dict[str, float]:
    """Full preview payload; all monetary values are canonical USD."""
    hours = compute_hours(
        tasks_attempter,
        tasks_reviewer,
        aht_attempter_minutes,
        aht_reviewer_minutes,
    )
    earnings = compute_earnings(hours, hourly_rate)
    return {
        "hours": hours,
        "earnings": earnings,
        "rate_per_task_attempter": rate_per_task(aht_attempter_minutes, hourly_rate),
        "rate_per_task_reviewer": rate_per_task(aht_reviewer_minutes, hourly_rate),
    }


def hours_and_earnings_from_log(
    tasks_attempter: int | float,
    tasks_reviewer: int | float,
    aht_attempter_minutes: float,
    aht_reviewer_minutes: float,
    hourly_rate: float,
    stored_hours: float | None = None,
    stored_earnings: float | None = None,
    stored_earnings_usd: float | None = None,
    snapshot_available: bool | None = None,
) -> tuple[float, float]:
    """
    Resolve hours/earnings for a historical log row.

    Prefer recomputing from available snapshot AHT/rate fields so analytics
    and exports stay consistent with the formula. If a row has no snapshot
    fields, fall back to its stored hours and canonical USD earnings.

    ``snapshot_available`` is supplied by row coercion when the source shape
    is known. The inferred default preserves the historical pure-function
    behavior for callers that pass only numeric values.
    """
    if snapshot_available is None:
        snapshot_available = (
            float(aht_attempter_minutes) != 0
            or float(aht_reviewer_minutes) != 0
            or float(hourly_rate) != 0
        )

    if snapshot_available:
        hours = compute_hours(
            tasks_attempter,
            tasks_reviewer,
            aht_attempter_minutes,
            aht_reviewer_minutes,
        )
        earnings = compute_earnings(hours, hourly_rate)
        return hours, earnings

    hours = float(stored_hours) if stored_hours is not None else 0.0
    stored_usd = (
        stored_earnings_usd
        if stored_earnings_usd is not None
        else stored_earnings
    )
    earnings = float(stored_usd) if stored_usd is not None else 0.0
    return hours, earnings
