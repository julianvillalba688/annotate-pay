"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchFxRates, type FxRate } from "@/lib/api";
import { persistProfilePreference } from "@/lib/profile-preferences";
import { formatCurrency } from "@/lib/formatters";
import { getMessage, DEFAULT_LOCALE, type Locale, type MessageKey, type MessageValues } from "@/lib/i18n/messages";
import { useProfile } from "@/hooks/useProfile";
import type { CurrencyCode } from "@/types";

const LOCALE_STORAGE_KEY = "annotatepay.locale";
const CURRENCY_STORAGE_KEY = "annotatepay.currency";
const FX_STALE_TIME = 6 * 60 * 60 * 1000;

export const CURRENCIES: CurrencyCode[] = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "MXN",
  "COP",
  "BRL",
  "JPY",
];

interface I18nContextValue {
  locale: Locale;
  localeCode: string;
  setLocale: (next: Locale) => void;
  t: (key: MessageKey | string, values?: MessageValues) => string;
}

interface CurrencyContextValue {
  currency: CurrencyCode;
  displayCurrency: CurrencyCode;
  rateToUsd: number;
  rates: FxRate[];
  isFallback: boolean;
  fxLoading: boolean;
  fxError: boolean;
  asOf?: string;
  setCurrency: (next: CurrencyCode) => void;
  formatMoney: (usdValue: number, digits?: number) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);
const CurrencyContext = createContext<CurrencyContextValue | undefined>(
  undefined,
);

function isLocale(value: string | null): value is Locale {
  return value === "en" || value === "es";
}

function isCurrency(value: string | null): value is CurrencyCode {
  return value != null && CURRENCIES.includes(value as CurrencyCode);
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [currency, setCurrencyState] = useState<CurrencyCode>("USD");
  const [localReady, setLocalReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    const storedCurrency = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (isLocale(storedLocale)) setLocaleState(storedLocale);
    if (isCurrency(storedCurrency)) setCurrencyState(storedCurrency);
    setLocalReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (!localReady || !profile) return;

    const hasLocalLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    const hasLocalCurrency = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    const profileLocale = profile.preferred_locale ?? null;
    const profileCurrency = profile.preferred_currency ?? null;
    if (!hasLocalLocale && isLocale(profileLocale)) {
      setLocaleState(profileLocale);
    } else if (isLocale(hasLocalLocale) && profileLocale !== hasLocalLocale) {
      void persistProfilePreference("preferred_locale", hasLocalLocale);
    }
    if (!hasLocalCurrency && isCurrency(profileCurrency)) {
      setCurrencyState(profileCurrency);
    } else if (isCurrency(hasLocalCurrency) && profileCurrency !== hasLocalCurrency) {
      void persistProfilePreference("preferred_currency", hasLocalCurrency);
    }
  }, [localReady, profile]);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setHasSession(Boolean(data.session));
      setAuthReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setHasSession(Boolean(session));
      setAuthReady(true);
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const fxQuery = useQuery({
    queryKey: ["fx-rates"],
    queryFn: fetchFxRates,
    enabled: authReady && hasSession,
    staleTime: FX_STALE_TIME,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  function setLocale(next: Locale) {
    setLocaleState(next);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    void persistProfilePreference("preferred_locale", next);
  }

  function setCurrency(next: CurrencyCode) {
    setCurrencyState(next);
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, next);
    void persistProfilePreference("preferred_currency", next);
  }

  const rates = fxQuery.error
    ? [{ code: "USD", rate_to_usd: 1 }]
    : fxQuery.data?.rates ?? [{ code: "USD", rate_to_usd: 1 }];
  const selectedRate =
    currency === "USD"
      ? 1
      : rates.find((rate) => rate.code === currency)?.rate_to_usd;
  const displayCurrency = selectedRate ? currency : "USD";
  const rateToUsd = selectedRate ?? 1;
  const localeCode = locale === "es" ? "es-ES" : "en-US";

  return (
    <I18nContext.Provider
      value={{
        locale,
        localeCode,
        setLocale,
        t: (key, values) => getMessage(locale, key, values),
      }}
    >
      <CurrencyContext.Provider
        value={{
          currency,
          displayCurrency,
          rateToUsd,
          rates,
          isFallback: currency !== "USD" && displayCurrency === "USD",
          fxLoading: fxQuery.isPending && hasSession,
          fxError: Boolean(fxQuery.error),
          asOf: fxQuery.data?.as_of,
          setCurrency,
          formatMoney: (usdValue, digits = 2) =>
            formatCurrency(usdValue, displayCurrency, rateToUsd, localeCode, digits),
        }}
      >
        {children}
      </CurrencyContext.Provider>
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used within PreferencesProvider");
  return context;
}

export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within PreferencesProvider");
  }
  return context;
}
