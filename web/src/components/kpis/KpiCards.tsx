"use client";

import {
  Check,
  Clock,
  DollarSign,
  FileEdit,
  ListChecks,
} from "lucide-react";
import { formatHours, formatNumber } from "@/lib/formatters";
import type { AnalyticsKpis } from "@/types";
import { cn } from "@/lib/utils";
import { useCurrency, useI18n } from "@/components/providers/PreferencesProvider";

interface KpiCardsProps {
  kpis?: AnalyticsKpis | null;
  loading?: boolean;
  paymentStatusAvailable?: boolean;
}

const CARDS = [
  {
    key: "earned" as const,
    labelKey: "kpi.grossEarnings",
    icon: DollarSign,
    accent: true,
    valueClass: "text-secondary-container",
  },
  {
    key: "paid" as const,
    labelKey: "kpi.paidEarnings",
    icon: Check,
    accent: false,
    valueClass: "text-tertiary",
  },
  {
    key: "pending" as const,
    labelKey: "kpi.pendingEarnings",
    icon: Clock,
    accent: false,
    valueClass: "text-primary",
  },
  {
    key: "att" as const,
    labelKey: "kpi.attempterTasks",
    icon: FileEdit,
    accent: false,
    valueClass: "text-on-surface",
  },
  {
    key: "rev" as const,
    labelKey: "kpi.reviewerTasks",
    icon: ListChecks,
    accent: false,
    valueClass: "text-on-surface",
  },
  {
    key: "hours" as const,
    labelKey: "kpi.hoursInvested",
    icon: Clock,
    accent: false,
    valueClass: "text-on-surface",
  },
];

export function KpiCards({ kpis, loading, paymentStatusAvailable }: KpiCardsProps) {
  const { t, localeCode } = useI18n();
  const { formatMoney, formatCompactMoney, displayCurrency } = useCurrency();
  const paymentDataAvailable =
    paymentStatusAvailable ??
    (typeof kpis?.total_paid === "number" &&
      typeof kpis?.total_pending === "number");
  const values = {
    earned: formatCompactMoney(kpis?.total_earned ?? 0),
    paid:
      paymentDataAvailable && typeof kpis?.total_paid === "number"
        ? formatCompactMoney(kpis.total_paid)
        : t("common.unavailable"),
    pending:
      paymentDataAvailable && typeof kpis?.total_pending === "number"
        ? formatCompactMoney(kpis.total_pending)
        : t("common.unavailable"),
    att: formatNumber(kpis?.total_tasks_attempter ?? 0, localeCode),
    rev: formatNumber(kpis?.total_tasks_reviewer ?? 0, localeCode),
    hours: formatHours(kpis?.total_hours ?? 0, localeCode),
  };
  const fullMoneyValues = {
    earned: formatMoney(kpis?.total_earned ?? 0),
    paid:
      paymentDataAvailable && typeof kpis?.total_paid === "number"
        ? formatMoney(kpis.total_paid)
        : undefined,
    pending:
      paymentDataAvailable && typeof kpis?.total_pending === "number"
        ? formatMoney(kpis.total_pending)
        : undefined,
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-gutter">
      {CARDS.map(({ key, labelKey, icon: Icon, accent, valueClass }) => (
        <div
          key={key}
          className={cn(
            "bg-surface-card cyber-border p-4 flex min-w-0 flex-col justify-between min-h-[120px]",
            accent && "shadow-glow-cyan-sm",
          )}
        >
          <div className="flex min-w-0 justify-between items-start mb-2 border-b border-anthracite pb-2 zebra-stripe">
            <span className="min-w-0 break-words font-mono text-label-caps text-outline">
               {t(
                 labelKey,
                 key === "earned" || key === "paid" || key === "pending"
                   ? { currency: displayCurrency }
                   : undefined,
               )}
            </span>
            <Icon
              className={cn(
                "h-4 w-4 shrink-0",
                accent ? "text-secondary-container" : "text-primary-container",
              )}
            />
          </div>
          <div
            className={cn(
              "min-w-0 max-w-full break-words font-mono text-3xl my-2 font-bold leading-tight tracking-tight",
                valueClass,
                loading && "animate-pulse opacity-40",
            )}
            title={
              key === "earned" || key === "paid" || key === "pending"
                ? fullMoneyValues[key]
                : undefined
            }
          >
            {loading ? "—" : values[key]}
          </div>
          {key === "hours" && !loading ? (
            <div className="w-full h-2 bg-[#1A1A1A] mt-1 relative overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full bg-cyan-neon"
                style={{
                  width: `${Math.min(100, ((kpis?.total_hours ?? 0) / 160) * 100)}%`,
                  boxShadow: "2px 0 4px #2ae500",
                }}
              />
            </div>
          ) : (
            <div className="h-2" />
          )}
        </div>
      ))}
      {!loading && !paymentDataAvailable ? (
        <div className="sm:col-span-2 xl:col-span-6 border border-error-bright/30 bg-error-container/10 px-3 py-2" role="alert">
          <p className="font-mono text-[11px] text-error-bright">
            {t("kpi.paymentStatusUnavailable")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
