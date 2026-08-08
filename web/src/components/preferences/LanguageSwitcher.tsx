"use client";

import { useI18n } from "@/components/providers/PreferencesProvider";
import type { Locale } from "@/lib/i18n/messages";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className="flex items-center gap-2 font-mono text-[10px] text-outline">
      <span className={compact ? "sr-only" : "uppercase tracking-widest"}>
        {t("common.language")}
      </span>
      <select
        aria-label={t("common.language")}
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        className="terminal-input w-auto border border-outline-variant/60 px-2 py-1 text-[10px] uppercase tracking-widest"
      >
        <option value="en" className="bg-anthracite">
          EN
        </option>
        <option value="es" className="bg-anthracite">
          ES
        </option>
      </select>
    </label>
  );
}
