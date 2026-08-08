/**
 * Client-side earnings preview, matching the backend and SQL contract.
 *
 * hours = (tasks_attempter * aht_attempter_minutes
 *        + tasks_reviewer * aht_reviewer_minutes) / 60
 * earnings = hours * USD hourly rate
 *
 * Historical logs use their immutable snapshot fields only.
 */

export function computeHours(
  tasksAttempter: number,
  tasksReviewer: number,
  ahtAttempterMinutes: number,
  ahtReviewerMinutes: number,
): number {
  const totalMinutes =
    Number(tasksAttempter) * Number(ahtAttempterMinutes) +
    Number(tasksReviewer) * Number(ahtReviewerMinutes);
  return totalMinutes / 60;
}

export function computeEarnings(hours: number, hourlyRate: number): number {
  return Number(hours) * Number(hourlyRate);
}

/** Resolve partially backfilled USD earnings without hiding a positive value. */
export function resolveEarningsUsd(
  calculatedEarningsUsd: unknown,
  calculatedEarnings: unknown,
): number {
  const usd = Number(calculatedEarningsUsd);
  const fallback = Number(calculatedEarnings);

  if (Number.isFinite(usd) && usd === 0 && Number.isFinite(fallback) && fallback > 0) {
    return fallback;
  }
  if (Number.isFinite(usd)) return usd;
  if (Number.isFinite(fallback)) return fallback;
  return 0;
}

export function ratePerTask(ahtMinutes: number, hourlyRate: number): number {
  return (Number(ahtMinutes) / 60) * Number(hourlyRate);
}

export function computePreview(
  tasksAttempter: number,
  tasksReviewer: number,
  ahtAttempterMinutes: number,
  ahtReviewerMinutes: number,
  hourlyRate: number,
): {
  hours: number;
  earnings: number;
  rate_per_task_attempter: number;
  rate_per_task_reviewer: number;
} {
  const hours = computeHours(
    tasksAttempter,
    tasksReviewer,
    ahtAttempterMinutes,
    ahtReviewerMinutes,
  );
  return {
    hours,
    earnings: computeEarnings(hours, hourlyRate),
    rate_per_task_attempter: ratePerTask(ahtAttempterMinutes, hourlyRate),
    rate_per_task_reviewer: ratePerTask(ahtReviewerMinutes, hourlyRate),
  };
}

/** Hours from a historical log using immutable snapshot fields only. */
export function hoursFromLog(log: {
  tasks_attempter: number;
  tasks_reviewer: number;
  snapshot_aht_attempter: number;
  snapshot_aht_reviewer: number;
}): number {
  return computeHours(
    log.tasks_attempter,
    log.tasks_reviewer,
    log.snapshot_aht_attempter,
    log.snapshot_aht_reviewer,
  );
}

// Keep the existing earnings module as the import surface while the formatters live centrally.
export {
  formatAhtMinutes,
  formatCurrency,
  formatDate,
  formatHours,
  formatNumber,
} from "@/lib/formatters";
