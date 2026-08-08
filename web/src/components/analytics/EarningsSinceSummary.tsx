"use client";

import { Button } from "@/components/ui/Button";
import { useCurrency, useI18n } from "@/components/providers/PreferencesProvider";
import { cn } from "@/lib/utils";
import {
  DEFAULT_EARNINGS_START_DATE,
  isValidEarningsStartDate,
} from "@/lib/earnings-start-date";
import { formatDate } from "@/lib/formatters";
import type { AnalyticsKpis } from "@/types";

interface EarningsSinceSummaryProps {
  kpis?: AnalyticsKpis | null;
  loading?: boolean;
  paymentStatusAvailable?: boolean;
  date: string;
  onDateChange: (date: string) => void;
}

export function EarningsSinceSummary({
  kpis,
  loading = false,
  paymentStatusAvailable,
  date,
  onDateChange,
}: EarningsSinceSummaryProps) {
  const { t, localeCode } = useI18n();
  const { formatMoney, displayCurrency } = useCurrency();
  const safeDate = isValidEarningsStartDate(date)
    ? date
    : DEFAULT_EARNINGS_START_DATE;
  const paymentDataAvailable =
    paymentStatusAvailable ??
    (typeof kpis?.total_paid === "number" &&
      typeof kpis?.total_pending === "number");
  const unavailable = t("earningsSince.unavailable");
  const generatedAmount = loading
    ? "..."
    : formatMoney(kpis?.total_earned ?? 0);
  const values = [
    {
      key: "gross",
      label: t("earningsSince.gross", { currency: displayCurrency }),
      value: generatedAmount,
      valueClass: "text-secondary-container",
    },
    {
      key: "paid",
      label: t("earningsSince.paid", { currency: displayCurrency }),
      value:
        loading
          ? "..."
          : paymentDataAvailable && typeof kpis?.total_paid === "number"
            ? formatMoney(kpis.total_paid)
            : unavailable,
      valueClass: "text-tertiary",
    },
    {
      key: "pending",
      label: t("earningsSince.pending", { currency: displayCurrency }),
      value:
        loading
          ? "..."
          : paymentDataAvailable && typeof kpis?.total_pending === "number"
            ? formatMoney(kpis.total_pending)
            : unavailable,
      valueClass: "text-primary",
    },
  ];

  return (
    <section
      aria-labelledby="earnings-since-title"
      className="min-w-0 border border-outline-variant/40 bg-surface-card p-4 sm:p-5"
    >
      <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <h2
          id="earnings-since-title"
          className="min-w-0 break-words font-sans text-headline-md text-on-surface"
        >
          {t("earningsSince.sentence", {
            date: formatDate(safeDate, localeCode),
            amount: generatedAmount,
          })}
        </h2>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 sm:w-48">
            <label
              htmlFor="earnings-since-date"
              className="mb-1 block font-mono text-label-caps text-primary-container"
            >
              {t("earningsSince.dateLabel")}
            </label>
            <input
              id="earnings-since-date"
              name="earnings_since_date"
              type="date"
              value={safeDate}
              onChange={(event) => {
                if (isValidEarningsStartDate(event.currentTarget.value)) {
                  onDateChange(event.currentTarget.value);
                }
              }}
              className="terminal-input min-w-0 py-2 pl-2 font-mono text-data-sm focus:ring-0"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            disabled={safeDate === DEFAULT_EARNINGS_START_DATE}
            onClick={() => onDateChange(DEFAULT_EARNINGS_START_DATE)}
            aria-label={t("earningsSince.reset")}
            className="shrink-0 px-2 py-2 text-left sm:text-center"
          >
            {t("earningsSince.reset")}
          </Button>
        </div>
      </div>

      <div className="mt-5 grid min-w-0 grid-cols-1 gap-3 border-t border-outline-variant/30 pt-4 sm:grid-cols-3">
        {values.map(({ key, label, value, valueClass }) => (
          <div
            key={key}
            className="min-w-0 overflow-hidden border border-outline-variant/30 bg-anthracite/60 p-3"
          >
            <p className="min-w-0 break-words font-mono text-label-caps text-outline">
              {label}
            </p>
            <p
              aria-live="polite"
              className={cn(
                "min-w-0 max-w-full break-words [overflow-wrap:anywhere] font-mono text-lg font-bold leading-tight tracking-tight sm:text-xl lg:text-2xl",
                valueClass,
                loading && "animate-pulse opacity-40",
              )}
            >
              {value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
