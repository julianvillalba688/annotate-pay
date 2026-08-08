"use client";

import {
  CURRENCIES,
  useCurrency,
  useI18n,
} from "@/components/providers/PreferencesProvider";
import type { CurrencyCode } from "@/types";

export function CurrencySelector({ compact = false }: { compact?: boolean }) {
  const { currency, displayCurrency, setCurrency, isFallback, fxLoading, fxError, asOf } =
    useCurrency();
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-end gap-1">
      <label className="flex items-center gap-2 font-mono text-[10px] text-outline">
        <span className={compact ? "sr-only" : "uppercase tracking-widest"}>
          {t("common.currency")}
        </span>
        <select
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
      {fxLoading ? (
        <span role="status" className="font-mono text-[9px] text-outline">
          {t("common.fxLoading")}
        </span>
      ) : isFallback || fxError ? (
        <span role="status" className="font-mono text-[9px] text-primary">
          {t("common.fxUnavailable")}
        </span>
      ) : displayCurrency !== "USD" && asOf ? (
        <span role="status" className="font-mono text-[9px] text-outline">
          {t("common.fxAsOf", { date: asOf })}
        </span>
      ) : null}
    </div>
  );
}
