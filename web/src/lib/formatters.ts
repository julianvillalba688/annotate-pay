import type { CurrencyCode } from "@/types";

/** Convert a canonical USD amount to the selected currency using USD per target unit. */
export function formatCurrency(
  usdValue: number,
  displayCurrency: CurrencyCode = "USD",
  rateToUsd = 1,
  locale = "en-US",
  digits = 2,
): string {
  const value = Number.isFinite(Number(usdValue)) ? Number(usdValue) : 0;
  const rate = Number.isFinite(Number(rateToUsd)) && Number(rateToUsd) > 0
    ? Number(rateToUsd)
    : 1;
  const converted = value / rate;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: displayCurrency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(converted);
}

export function formatHours(value: number, locale = "en-US"): string {
  const hours = Number.isFinite(Number(value)) ? Number(value) : 0;
  if (hours < 0.01 && hours > 0) return "<0.01h";
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(hours)}h`;
}

export function formatAhtMinutes(value: number, locale = "en-US"): string {
  const minutes = Math.max(0, Number(value) || 0);
  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }).format(minutes)} min`;
}

export function formatNumber(value: number, locale = "en-US"): string {
  return new Intl.NumberFormat(locale).format(Number(value) || 0);
}

export function formatDate(value: string, locale = "en-US"): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}
