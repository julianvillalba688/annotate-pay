const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const DEFAULT_EARNINGS_START_DATE = "2026-07-03";
export const EARNINGS_START_DATE_STORAGE_KEY = "annotatepay.earningsStartDate";

export function isValidEarningsStartDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  );
}

export function readEarningsStartDate(): string {
  if (typeof window === "undefined") return DEFAULT_EARNINGS_START_DATE;

  try {
    const stored = window.localStorage.getItem(EARNINGS_START_DATE_STORAGE_KEY);
    return isValidEarningsStartDate(stored)
      ? stored
      : DEFAULT_EARNINGS_START_DATE;
  } catch {
    return DEFAULT_EARNINGS_START_DATE;
  }
}

export function persistEarningsStartDate(value: string): void {
  if (!isValidEarningsStartDate(value) || typeof window === "undefined") return;

  try {
    window.localStorage.setItem(EARNINGS_START_DATE_STORAGE_KEY, value);
  } catch {
    // Local storage can be unavailable in privacy-restricted browser contexts.
  }
}
