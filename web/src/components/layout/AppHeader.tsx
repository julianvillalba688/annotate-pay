"use client";

import { useProfile } from "@/hooks/useProfile";
import {
  useCurrency,
  useI18n,
} from "@/components/providers/PreferencesProvider";
import { CurrencySelector } from "@/components/preferences/CurrencySelector";
import { LanguageSwitcher } from "@/components/preferences/LanguageSwitcher";
import { UserMenu } from "@/components/layout/UserMenu";

export function AppHeader({ title }: { title?: string }) {
  const { data: profile } = useProfile();
  const { t } = useI18n();
  const { formatMoney, formatCompactMoney, displayCurrency } = useCurrency();
  const rate = profile?.global_hourly_rate ?? 0;
  const compactRate = formatCompactMoney(rate);
  const fullRate = formatMoney(rate);
  const rateTitle = `${t("header.hourlyRate")}: ${fullRate} (${displayCurrency})`;

  return (
    <header
      id="header-preferences"
      className="sticky top-0 z-40 border-b border-outline-variant bg-surface/80 backdrop-blur-xl scroll-mt-16"
    >
      {/* Mobile top bar */}
      <div className="flex min-w-0 items-center justify-between gap-3 px-margin-mobile py-2 md:hidden">
        <div className="font-mono text-data-sm font-bold text-primary tracking-tighter">
          ANNOTATE_PAY
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 text-secondary-container">
          <CurrencySelector compact />
          <LanguageSwitcher compact />
          <span
            className="hidden sm:inline min-w-0 max-w-full break-words text-right font-mono text-data-sm"
            title={rateTitle}
            aria-label={rateTitle}
          >
            {compactRate} / {t("common.perHour")} ({displayCurrency})
          </span>
          <UserMenu id="user-menu-mobile" />
        </div>
      </div>

      {/* Desktop sticky header */}
      <div className="hidden md:flex">
        <div className="flex min-w-0 justify-between items-center w-full px-margin-desktop min-h-14 py-2">
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
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-4">
            <span
              className="min-w-0 max-w-full break-words text-right font-mono text-data-lg text-secondary-container font-bold"
              title={rateTitle}
              aria-label={rateTitle}
            >
              {compactRate} / {t("common.perHour")} ({displayCurrency})
            </span>
            <CurrencySelector compact />
            <LanguageSwitcher compact />
            <UserMenu id="user-menu-desktop" />
          </div>
        </div>
      </div>
    </header>
  );
}
