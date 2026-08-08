"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAnalyticsSummary } from "@/lib/api";
import { hoursFromLog, resolveEarningsUsd } from "@/lib/earnings";
import { resolvePaymentStatus } from "@/lib/payments";
import { createClient } from "@/lib/supabase/client";
import type {
  AnalyticsKpis,
  AnalyticsFilters,
  AnalyticsSeriesPoint,
  AnalyticsSummary,
  GroupBy,
  TaskLog,
} from "@/types";

function mapLog(row: Record<string, unknown>): TaskLog {
  const earningsUsd = resolveEarningsUsd(
    row.calculated_earnings_usd,
    row.calculated_earnings,
  );
  const payment = resolvePaymentStatus(row.payment_status);
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
    payment_status: payment.status,
    payment_status_available: payment.available,
    paid_at: typeof row.paid_at === "string" ? row.paid_at : null,
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
): AnalyticsSummary & { paymentStatusAvailable: boolean } {
  let paymentStatusAvailable = true;
  let totalPaid = 0;
  let totalPending = 0;
  const kpis: AnalyticsKpis = {
    total_earned: 0,
    total_tasks_attempter: 0,
    total_tasks_reviewer: 0,
    total_tasks_completed: 0,
    total_hours: 0,
    total_paid: 0,
    total_pending: 0,
  };

  const buckets = new Map<string, AnalyticsSeriesPoint>();

  for (const log of logs) {
    const hours = hoursFromLog(log);
    const earnings = resolveEarningsUsd(
      log.calculated_earnings_usd,
      log.calculated_earnings,
    );

    kpis.total_earned += earnings;
    kpis.total_tasks_attempter += log.tasks_attempter;
    kpis.total_tasks_reviewer += log.tasks_reviewer;
    kpis.total_tasks_completed =
      (kpis.total_tasks_completed ?? 0) +
      log.tasks_attempter +
      log.tasks_reviewer;
    kpis.total_hours += hours;
    if (
      log.payment_status_available === false ||
      (log.payment_status !== "paid" && log.payment_status !== "pending")
    ) {
      paymentStatusAvailable = false;
    }
    if (log.payment_status === "paid") {
      totalPaid += earnings;
    } else {
      totalPending += earnings;
    }

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
      tasks_completed: 0,
      hours: 0,
      paid: 0,
      pending: 0,
    };
    prev.earnings += earnings;
    prev.tasks_attempter += log.tasks_attempter;
    prev.tasks_reviewer += log.tasks_reviewer;
    prev.tasks_completed =
      (prev.tasks_completed ?? 0) +
      log.tasks_attempter +
      log.tasks_reviewer;
    prev.hours += hours;
    if (log.payment_status === "paid") {
      prev.paid = (prev.paid ?? 0) + earnings;
    } else {
      prev.pending = (prev.pending ?? 0) + earnings;
    }
    buckets.set(key, prev);
  }

  const series = Array.from(buckets.values()).sort((a, b) =>
    a.key.localeCompare(b.key),
  );

  if (paymentStatusAvailable) {
    kpis.total_paid = totalPaid;
    kpis.total_pending = totalPending;
  } else {
    delete kpis.total_paid;
    delete kpis.total_pending;
  }

  const paymentSafeSeries = paymentStatusAvailable
    ? series
    : withoutPaymentSeries(series);

  return {
    kpis,
    series: paymentSafeSeries,
    paymentStatusAvailable,
  };
}

function asFiniteNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function asNumber(value: unknown): number {
  return asFiniteNumber(value) ?? 0;
}

function normalizeApiSummary(summary: AnalyticsSummary): AnalyticsSummary {
  const rawKpis = summary.kpis as Partial<AnalyticsKpis> | undefined;
  const totalTasksAttempter = asNumber(rawKpis?.total_tasks_attempter);
  const totalTasksReviewer = asNumber(rawKpis?.total_tasks_reviewer);
  return {
    kpis: {
      total_earned: asNumber(rawKpis?.total_earned),
      total_paid: asFiniteNumber(rawKpis?.total_paid),
      total_pending: asFiniteNumber(rawKpis?.total_pending),
      total_tasks_attempter: totalTasksAttempter,
      total_tasks_reviewer: totalTasksReviewer,
      total_tasks_completed:
        asFiniteNumber(rawKpis?.total_tasks_completed) ??
        totalTasksAttempter + totalTasksReviewer,
      total_hours: asNumber(rawKpis?.total_hours),
    },
    series: (summary.series ?? []).map((point) => {
      const tasksAttempter = asNumber(point.tasks_attempter);
      const tasksReviewer = asNumber(point.tasks_reviewer);
      const tasksCompleted = asFiniteNumber(point.tasks_completed);
      return {
        key: String(point.key),
        label: String(point.label),
        earnings: asNumber(point.earnings),
        paid: asFiniteNumber(point.paid),
        pending: asFiniteNumber(point.pending),
        tasks_attempter: tasksAttempter,
        tasks_reviewer: tasksReviewer,
        tasks_completed: tasksCompleted ?? tasksAttempter + tasksReviewer,
        hours: asNumber(point.hours),
      };
    }),
  };
}

function hasPaymentKpis(summary: AnalyticsSummary): boolean {
  return (
    asFiniteNumber(summary.kpis.total_paid) !== undefined &&
    asFiniteNumber(summary.kpis.total_pending) !== undefined
  );
}

function withoutPaymentSeries(
  series: AnalyticsSeriesPoint[],
): AnalyticsSeriesPoint[] {
  return series.map((point) => {
    const pointWithoutPayment = { ...point };
    delete pointWithoutPayment.paid;
    delete pointWithoutPayment.pending;
    return pointWithoutPayment;
  });
}

function mergePaymentSeries(
  apiSeries: AnalyticsSeriesPoint[],
  clientSeries: AnalyticsSeriesPoint[],
): AnalyticsSeriesPoint[] {
  const clientByKey = new Map(clientSeries.map((point) => [point.key, point]));
  return apiSeries.map((point) => {
    const clientPoint = clientByKey.get(point.key);
    return clientPoint
      ? {
          ...point,
          paid: clientPoint.paid,
          pending: clientPoint.pending,
        }
      : point;
  });
}

interface AnalyticsResult extends AnalyticsSummary {
  source: "api" | "client";
  paymentStatusAvailable: boolean;
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
      AnalyticsResult
    > => {
      try {
        const summary = normalizeApiSummary(await fetchAnalyticsSummary(filters));
        if (hasPaymentKpis(summary)) {
          return { ...summary, source: "api", paymentStatusAvailable: true };
        }

        try {
          const logs = await fetchLogsClient(filters);
          const clientSummary = aggregateClient(logs, filters.group_by ?? "month");
          if (!clientSummary.paymentStatusAvailable) {
            return {
              ...summary,
              kpis: {
                ...summary.kpis,
                total_paid: undefined,
                total_pending: undefined,
              },
              series: withoutPaymentSeries(summary.series),
              source: "api",
              paymentStatusAvailable: false,
            };
          }
          return {
            ...summary,
            kpis: {
              ...summary.kpis,
              total_paid: clientSummary.kpis.total_paid,
              total_pending: clientSummary.kpis.total_pending,
            },
            series:
              summary.series.length > 0
                ? mergePaymentSeries(summary.series, clientSummary.series)
                : clientSummary.series,
            source: "api",
            paymentStatusAvailable: true,
          };
        } catch {
          return {
            ...summary,
            kpis: {
              ...summary.kpis,
              total_paid: undefined,
              total_pending: undefined,
            },
            series: withoutPaymentSeries(summary.series),
            source: "api",
            paymentStatusAvailable: false,
          };
        }
      } catch {
        try {
          const logs = await fetchLogsClient(filters);
          const summary = aggregateClient(logs, filters.group_by ?? "month");
          return { ...summary, source: "client" };
        } catch {
          // Keep raw API/Supabase errors out of the UI and logs shown to users.
          throw new Error("ANALYTICS_UNAVAILABLE");
        }
      }
    },
  });
}
