import type { AnalyticsFilters, AnalyticsSummary } from "@/types";
import { createClient } from "@/lib/supabase/client";

export interface FxRate {
  code: string;
  rate_to_usd: number;
}

export interface FxRatesResponse {
  base: string;
  as_of?: string;
  rates: FxRate[];
  source?: string;
  stale?: boolean;
}

export interface FetchFxRatesOptions {
  forceRefresh?: boolean;
}

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(
    /\/$/,
    "",
  );
}

async function getAccessToken(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken();
  if (!token) {
     throw new Error("AUTH_REQUIRED");
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  return fetch(`${apiBase()}${path}`, { ...init, headers });
}

function buildQuery(params: Record<string, string | undefined | null>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") q.set(k, v);
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function fetchAnalyticsSummary(
  filters: AnalyticsFilters = {},
): Promise<AnalyticsSummary> {
  const qs = buildQuery({
    project_id: filters.project_id ?? undefined,
    date_from: filters.date_from ?? undefined,
    date_to: filters.date_to ?? undefined,
    group_by: filters.group_by ?? "month",
  });
  const res = await apiFetch(`/api/v1/analytics/summary${qs}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Analytics API error ${res.status}`);
  }
  return res.json() as Promise<AnalyticsSummary>;
}

export async function fetchFxRates(
  { forceRefresh = false }: FetchFxRatesOptions = {},
): Promise<FxRatesResponse> {
  const qs = buildQuery({
    refresh: forceRefresh ? "true" : undefined,
  });
  const res = await apiFetch(`/api/v1/fx/rates${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `FX API error ${res.status}`);
  }

  const payload = (await res.json()) as {
    base?: string;
    as_of?: string;
    rates?: FxRate[] | Record<string, number>;
    source?: string;
    stale?: boolean;
  };
  const rawRates = payload.rates ?? [];
  const rates = Array.isArray(rawRates)
    ? rawRates
    : Object.entries(rawRates).map(([code, rate]) => ({
        code,
        rate_to_usd: Number(rate),
      }));

  return {
    base: payload.base ?? "USD",
    as_of: payload.as_of,
    source: payload.source,
    stale: payload.stale,
    rates: [
      { code: "USD", rate_to_usd: 1 },
      ...rates
        .filter((rate) => rate.code !== "USD" && Number(rate.rate_to_usd) > 0)
        .map((rate) => ({
          code: rate.code.toUpperCase(),
          rate_to_usd: Number(rate.rate_to_usd),
        })),
    ],
  };
}

export async function exportTaskLogs(
  filters: AnalyticsFilters & { format?: "csv" | "xlsx" } = {},
): Promise<Blob> {
  const qs = buildQuery({
    project_id: filters.project_id ?? undefined,
    date_from: filters.date_from ?? undefined,
    date_to: filters.date_to ?? undefined,
    format: filters.format ?? "csv",
  });
  const res = await apiFetch(`/api/v1/exports/task-logs${qs}`, {
    headers: { Accept: "text/csv, application/json, */*" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Export API error ${res.status}`);
  }
  return res.blob();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
