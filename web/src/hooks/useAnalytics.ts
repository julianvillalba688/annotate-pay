"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAnalyticsSummary } from "@/lib/api";
import { hoursFromLog } from "@/lib/earnings";
import { createClient } from "@/lib/supabase/client";
import type {
  AnalyticsFilters,
  AnalyticsSeriesPoint,
  AnalyticsSummary,
  GroupBy,
  TaskLog,
} from "@/types";

function mapLog(row: Record<string, unknown>): TaskLog {
  const earningsUsd =
    Number(row.calculated_earnings_usd ?? row.calculated_earnings) || 0;
  return {
    ...(row as unknown as TaskLog),
    tasks_attempter: Number(row.tasks_attempter) || 0,
    tasks_reviewer: Number(row.tasks_reviewer) || 0,
    snapshot_aht_attempter: Number(row.snapshot_aht_attempter) || 0,
    snapshot_aht_reviewer: Number(row.snapshot_aht_reviewer) || 0,
    hourly_rate_used: Number(row.hourly_rate_used) || 0,
    calculated_earnings: earningsUsd,
    calculated_earnings_usd: earningsUsd,
    currency_code: "USD",
    fx_rate_to_usd: 1,
  };
}

async function fetchLogsClient(
  filters: AnalyticsFilters,
): Promise<TaskLog[]> {
  const supabase = createClient();
  let q = supabase
    .from("task_logs")
    .select("*, projects(id, name)")
    .order("date", { ascending: true });

  if (filters.project_id) q = q.eq("project_id", filters.project_id);
  if (filters.date_from) q = q.gte("date", filters.date_from);
  if (filters.date_to) q = q.lte("date", filters.date_to);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => mapLog(r as Record<string, unknown>));
}

function aggregateClient(
  logs: TaskLog[],
  groupBy: GroupBy = "month",
): AnalyticsSummary {
  const kpis = {
    total_earned: 0,
    total_tasks_attempter: 0,
    total_tasks_reviewer: 0,
    total_hours: 0,
  };

  const buckets = new Map<string, AnalyticsSeriesPoint>();

  for (const log of logs) {
    const hours = hoursFromLog(log);
    const earnings =
      Number(log.calculated_earnings_usd ?? log.calculated_earnings) || 0;

    kpis.total_earned += earnings;
    kpis.total_tasks_attempter += log.tasks_attempter;
    kpis.total_tasks_reviewer += log.tasks_reviewer;
    kpis.total_hours += hours;

    let key: string;
    let label: string;
    if (groupBy === "project") {
      key = log.project_id;
      label = log.projects?.name ?? log.project_id.slice(0, 8);
    } else {
      // month
      const d = String(log.date).slice(0, 7); // YYYY-MM
      key = d;
      label = d;
    }

    const prev = buckets.get(key) ?? {
      key,
      label,
      earnings: 0,
      tasks_attempter: 0,
      tasks_reviewer: 0,
      hours: 0,
    };
    prev.earnings += earnings;
    prev.tasks_attempter += log.tasks_attempter;
    prev.tasks_reviewer += log.tasks_reviewer;
    prev.hours += hours;
    buckets.set(key, prev);
  }

  const series = Array.from(buckets.values()).sort((a, b) =>
    a.key.localeCompare(b.key),
  );

  return { kpis, series };
}

export function useAnalytics(filters: AnalyticsFilters = {}) {
  return useQuery({
    queryKey: [
      "analytics",
      filters.project_id ?? null,
      filters.date_from ?? null,
      filters.date_to ?? null,
      filters.group_by ?? "month",
    ],
    queryFn: async (): Promise<
      AnalyticsSummary & { source: "api" | "client" }
    > => {
      try {
        const summary = await fetchAnalyticsSummary(filters);
        return { ...summary, source: "api" };
      } catch {
        const logs = await fetchLogsClient(filters);
        const summary = aggregateClient(logs, filters.group_by ?? "month");
        return { ...summary, source: "client" };
      }
    },
  });
}
