import type { AnalyticsFilters, AnalyticsSummary } from "@/types";
import { createClient } from "@/lib/supabase/client";

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
    throw new Error("Not authenticated");
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
