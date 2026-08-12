"use client";

import {
  CURRENCIES,
  useCurrency,
  useI18n,
} from "@/components/providers/PreferencesProvider";
import type { CurrencyCode } from "@/types";
import { RefreshCw } from "lucide-react";

export function CurrencySelector({ compact = false }: { compact?: boolean }) {
  const {
    currency,
    setCurrency,
    isFallback,
    fxLoading,
    fxRefreshing,
    fxError,
    fxHasData,
    fxStale,
    asOf,
    refreshRates,
  } = useCurrency();
  const { t } = useI18n();
  const rateBusy = fxLoading || fxRefreshing;
  const refreshLabel = rateBusy
    ? t("common.fxRefreshing")
    : t("common.fxRefresh");

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2 font-mono text-[10px] text-outline">
        <label className="flex items-center gap-2">
          <span className={compact ? "sr-only" : "uppercase tracking-widest"}>
            {t("common.currency")}
          </span>
           <select
             data-onboarding-target="preferences-currency"
             aria-label={t("common.currency")}
            value={currency}
            onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
            className="terminal-input w-auto border border-outline-variant/60 px-2 py-1 text-[10px] uppercase tracking-widest"
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code} className="bg-anthracite">
                {code}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-label={refreshLabel}
          aria-busy={rateBusy}
          title={refreshLabel}
          disabled={rateBusy}
          onClick={() => void refreshRates()}
          className="inline-flex h-6 w-6 items-center justify-center border border-outline-variant/60 text-outline transition-colors hover:border-secondary-container hover:text-secondary-container disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3 w-3 ${rateBusy ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          <span className="sr-only">{refreshLabel}</span>
        </button>
      </div>
      {fxLoading ? (
        <span role="status" className="font-mono text-[9px] text-outline">
          {t("common.fxLoading")}
        </span>
      ) : fxRefreshing ? (
        <span role="status" className="font-mono text-[9px] text-outline">
          {t("common.fxRefreshing")}
        </span>
      ) : isFallback || (fxError && !fxHasData) ? (
        <span role="status" className="font-mono text-[9px] text-primary">
          {t("common.fxUnavailable")}
        </span>
      ) : fxStale || fxError ? (
        <span role="status" className="font-mono text-[9px] text-primary">
          {t("common.fxStale")}
          {asOf ? ` ${t("common.fxAsOf", { date: asOf })}` : ""}
        </span>
      ) : asOf ? (
        <span role="status" className="font-mono text-[9px] text-outline">
          {t("common.fxAsOf", { date: asOf })}
        </span>
      ) : null}
    </div>
  );
}
