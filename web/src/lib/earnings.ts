/**
 * Client-side earnings preview — must match backend/SQL formula.
 *
 * hours = (tasks_attempter * aht_attempter_sec + tasks_reviewer * aht_reviewer_sec) / 3600
 * earnings = hours * hourly_rate
 *
 * AHT values are in SECONDS. Historical logs use DB snapshot fields only.
 */

export function computeHours(
  tasksAttempter: number,
  tasksReviewer: number,
  ahtAttempterSec: number,
  ahtReviewerSec: number,
): number {
  const totalSeconds =
    Number(tasksAttempter) * Number(ahtAttempterSec) +
    Number(tasksReviewer) * Number(ahtReviewerSec);
  return totalSeconds / 3600;
}

export function computeEarnings(hours: number, hourlyRate: number): number {
  return Number(hours) * Number(hourlyRate);
}

export function ratePerTask(ahtSeconds: number, hourlyRate: number): number {
  return (Number(ahtSeconds) / 3600) * Number(hourlyRate);
}

export function computePreview(
  tasksAttempter: number,
  tasksReviewer: number,
  ahtAttempterSec: number,
  ahtReviewerSec: number,
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
    ahtAttempterSec,
    ahtReviewerSec,
  );
  return {
    hours,
    earnings: computeEarnings(hours, hourlyRate),
    rate_per_task_attempter: ratePerTask(ahtAttempterSec, hourlyRate),
    rate_per_task_reviewer: ratePerTask(ahtReviewerSec, hourlyRate),
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

export function formatCurrency(value: number, digits = 2): string {
  const n = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

export function formatHours(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  if (n < 0.01 && n > 0) return "<0.01h";
  return `${n.toFixed(2)}h`;
}

export function formatAhtSeconds(seconds: number): string {
  const s = Math.max(0, Number(seconds) || 0);
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  if (rem === 0) return `${m}m`;
  return `${m}m ${rem}s`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(Number(value) || 0);
}
