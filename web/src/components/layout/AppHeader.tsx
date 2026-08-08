"use client";

import { useProfile } from "@/hooks/useProfile";
import {
  useCurrency,
  useI18n,
} from "@/components/providers/PreferencesProvider";
import { CurrencySelector } from "@/components/preferences/CurrencySelector";
import { LanguageSwitcher } from "@/components/preferences/LanguageSwitcher";
import { User } from "lucide-react";

export function AppHeader({ title }: { title?: string }) {
  const { data: profile } = useProfile();
  const { t } = useI18n();
  const { formatMoney, displayCurrency } = useCurrency();
  const rate = profile?.global_hourly_rate ?? 0;

  return (
    <>
      {/* Mobile top bar */}
      <header className="md:hidden flex justify-between items-center w-full px-margin-mobile min-h-14 py-2 bg-surface/80 backdrop-blur-xl border-b border-outline-variant sticky top-0 z-40 gap-3">
        <div className="font-mono text-data-sm font-bold text-primary tracking-tighter">
          ANNOTATE_PAY
        </div>
        <div className="flex items-center gap-2 text-secondary-container">
          <CurrencySelector compact />
          <LanguageSwitcher compact />
          <span className="hidden sm:inline font-mono text-data-sm" title={t("header.hourlyRate")}>
            {formatMoney(rate)} / {t("common.perHour")} ({displayCurrency})
          </span>
          <div className="w-7 h-7 border border-outline-variant bg-surface-variant flex items-center justify-center">
            <User className="h-3.5 w-3.5 text-on-surface-variant" aria-hidden="true" />
          </div>
        </div>
      </header>

      {/* Desktop sticky header */}
      <header className="hidden md:flex sticky top-0 z-30 bg-surface/80 backdrop-blur-xl border-b border-outline-variant">
        <div className="flex justify-between items-center w-full px-margin-desktop min-h-14 py-2">
          <div className="flex items-center gap-4">
            {title ? (
              <span className="font-mono text-data-sm text-on-surface-variant tracking-widest uppercase">
                {title}
              </span>
            ) : (
              <span className="font-mono text-data-sm text-outline">
                {t("header.workspace")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-data-lg text-secondary-container font-bold" title={t("header.hourlyRate")}>
              {formatMoney(rate)} / {t("common.perHour")} ({displayCurrency})
            </span>
            <CurrencySelector compact />
            <LanguageSwitcher compact />
            <div className="w-8 h-8 border border-outline-variant bg-surface-variant flex items-center justify-center">
              <User className="h-4 w-4 text-on-surface-variant" aria-hidden="true" />
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
