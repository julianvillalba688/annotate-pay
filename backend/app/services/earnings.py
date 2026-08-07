"""
Pure earnings math for AnnotatePay.

Authoritative formula (document & enforce everywhere):

    hours = (tasks_attempter * aht_attempter_seconds
             + tasks_reviewer * aht_reviewer_seconds) / 3600
    earnings = hours * hourly_rate

Notes:
- AHT values are in SECONDS.
- Zero tasks are allowed for either role.
- Historical snapshots are immutable: when aggregating/exporting logs,
  always use the AHT and hourly_rate stored on each log row — never
  "fix" past logs with current project defaults.
"""

from __future__ import annotations


def compute_hours(
    tasks_attempter: int | float,
    tasks_reviewer: int | float,
    aht_attempter_seconds: float,
    aht_reviewer_seconds: float,
) -> float:
    """Return total hours from task counts and AHT (seconds)."""
    total_seconds = (
        float(tasks_attempter) * float(aht_attempter_seconds)
        + float(tasks_reviewer) * float(aht_reviewer_seconds)
    )
    return total_seconds / 3600.0


def compute_earnings(hours: float, hourly_rate: float) -> float:
    """Return earnings = hours * hourly_rate."""
    return float(hours) * float(hourly_rate)


def rate_per_task(aht_seconds: float, hourly_rate: float) -> float:
    """
    Effective $ per single task for a role.

        rate_per_task = (aht_seconds / 3600) * hourly_rate
    """
    return (float(aht_seconds) / 3600.0) * float(hourly_rate)


def compute_preview(
    tasks_attempter: int | float,
    tasks_reviewer: int | float,
    aht_attempter_seconds: float,
    aht_reviewer_seconds: float,
    hourly_rate: float,
) -> dict[str, float]:
    """Full preview payload for POST /calculations/preview."""
    hours = compute_hours(
        tasks_attempter,
        tasks_reviewer,
        aht_attempter_seconds,
        aht_reviewer_seconds,
    )
    earnings = compute_earnings(hours, hourly_rate)
    return {
        "hours": hours,
        "earnings": earnings,
        "rate_per_task_attempter": rate_per_task(aht_attempter_seconds, hourly_rate),
        "rate_per_task_reviewer": rate_per_task(aht_reviewer_seconds, hourly_rate),
    }


def hours_and_earnings_from_log(
    tasks_attempter: int | float,
    tasks_reviewer: int | float,
    aht_attempter_seconds: float,
    aht_reviewer_seconds: float,
    hourly_rate: float,
    stored_hours: float | None = None,
    stored_earnings: float | None = None,
) -> tuple[float, float]:
    """
    Resolve hours/earnings for a historical log row.

    Prefer recomputing from snapshot AHT/rate fields so exports stay
    consistent with the formula. If snapshot AHT/rate are all zero but
    stored hours/earnings exist, fall back to stored values.
    """
    has_snapshot_inputs = (
        float(aht_attempter_seconds) != 0
        or float(aht_reviewer_seconds) != 0
        or float(hourly_rate) != 0
        or float(tasks_attempter) != 0
        or float(tasks_reviewer) != 0
    )

    if has_snapshot_inputs:
        hours = compute_hours(
            tasks_attempter,
            tasks_reviewer,
            aht_attempter_seconds,
            aht_reviewer_seconds,
        )
        earnings = compute_earnings(hours, hourly_rate)
        return hours, earnings

    hours = float(stored_hours) if stored_hours is not None else 0.0
    earnings = float(stored_earnings) if stored_earnings is not None else 0.0
    return hours, earnings
