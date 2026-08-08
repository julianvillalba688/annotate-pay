import type { CurrencyCode } from "@/types";

/**
 * Normal display precision for supported currencies. COP is displayed in
 * whole pesos for converted earnings, while JPY follows its zero-decimal
 * currency convention. Canonical accounting values remain USD.
 */
const CURRENCY_DISPLAY_DIGITS: Record<CurrencyCode, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  CAD: 2,
  MXN: 2,
  COP: 0,
  BRL: 2,
  JPY: 0,
};

function convertedCurrencyValue(
  usdValue: number,
  rateToUsd: number,
): number {
  const value = Number.isFinite(Number(usdValue)) ? Number(usdValue) : 0;
  const rate = Number.isFinite(Number(rateToUsd)) && Number(rateToUsd) > 0
    ? Number(rateToUsd)
    : 1;
  return value / rate;
}

function currencyDisplayDigits(currency: CurrencyCode): number {
  return CURRENCY_DISPLAY_DIGITS[currency];
}

/** Convert a canonical USD amount to the selected currency using USD per target unit. */
export function formatCurrency(
  usdValue: number,
  displayCurrency: CurrencyCode = "USD",
  rateToUsd = 1,
  locale = "en-US",
  digits?: number,
): string {
  const converted = convertedCurrencyValue(usdValue, rateToUsd);
  const fractionDigits = digits ?? currencyDisplayDigits(displayCurrency);

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: displayCurrency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(converted);
}

/**
 * Format a converted currency for constrained summary surfaces. Values below
 * 1,000 keep their normal currency precision; larger values use locale-aware
 * compact notation while retaining the currency symbol or code from Intl.
 */
export function formatCompactCurrency(
  usdValue: number,
  displayCurrency: CurrencyCode = "USD",
  rateToUsd = 1,
  locale = "en-US",
): string {
  const converted = convertedCurrencyValue(usdValue, rateToUsd);
  const digits = currencyDisplayDigits(displayCurrency);

  if (Math.abs(converted) < 1000) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: displayCurrency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(converted);
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: displayCurrency,
    notation: "compact",
    compactDisplay: "short",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
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
