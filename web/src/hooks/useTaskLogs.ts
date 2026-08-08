"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { resolveEarningsUsd } from "@/lib/earnings";
import {
  isPaymentStatusSchemaMissing,
  resolvePaymentStatus,
} from "@/lib/payments";
import type { PaymentStatus, TaskLog, TaskLogInsert } from "@/types";

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

export function useTaskLogs(limit = 50) {
  return useQuery({
    queryKey: ["task_logs", limit],
    queryFn: async (): Promise<TaskLog[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("task_logs")
        .select("*, projects(id, name)")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        const raw = error.message.toLowerCase();
        if (raw.includes("payment_status") || raw.includes("paid_at")) {
          throw new Error("PAYMENT_STATUS_UNAVAILABLE");
        }
        throw error;
      }
      return (data ?? []).map((r) => mapLog(r as Record<string, unknown>));
    },
  });
}

export function useAllTaskLogs(filters?: {
  project_id?: string | null;
  date_from?: string | null;
  date_to?: string | null;
}) {
  return useQuery({
    queryKey: [
      "task_logs",
      "all",
      filters?.project_id ?? null,
      filters?.date_from ?? null,
      filters?.date_to ?? null,
    ],
    queryFn: async (): Promise<TaskLog[]> => {
      const supabase = createClient();
      let q = supabase
        .from("task_logs")
        .select("*, projects(id, name)")
        .order("date", { ascending: true });

      if (filters?.project_id) q = q.eq("project_id", filters.project_id);
      if (filters?.date_from) q = q.gte("date", filters.date_from);
      if (filters?.date_to) q = q.lte("date", filters.date_to);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((r) => mapLog(r as Record<string, unknown>));
    },
  });
}

export function useCreateTaskLog() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: Omit<TaskLogInsert, "user_id">,
    ): Promise<TaskLog> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("AUTH_REQUIRED");

      // The DB trigger freezes minute snapshots and the canonical USD rate.
      // Zero placeholders satisfy legacy NOT NULL columns before the trigger runs.
      const insertValues = {
        user_id: user.id,
        project_id: input.project_id,
        date: input.date,
        tasks_attempter: input.tasks_attempter,
        tasks_reviewer: input.tasks_reviewer,
        snapshot_aht_attempter: 0,
        snapshot_aht_reviewer: 0,
        hourly_rate_used: 0,
      };
      let usedPaymentStatusFallback = false;
      let { data, error } = await supabase
        .from("task_logs")
        .insert({ ...insertValues, payment_status: input.payment_status })
        .select("*, projects(id, name)")
        .single();

      if (error && isPaymentStatusSchemaMissing(error)) {
        usedPaymentStatusFallback = true;
        ({ data, error } = await supabase
          .from("task_logs")
          .insert(insertValues)
          .select("*, projects(id, name)")
          .single());
      }

      if (error) throw error;
      const row = mapLog(data as Record<string, unknown>);
      return usedPaymentStatusFallback
        ? {
            ...row,
            payment_status: "pending",
            payment_status_available: false,
            paid_at: null,
          }
        : row;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["task_logs"] });
      void qc.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}

export function useUpdateTaskLogPaymentStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      payment_status,
    }: {
      id: string;
      payment_status: PaymentStatus;
    }): Promise<TaskLog> => {
      const supabase = createClient();
      // The database migration owns paid_at so client clock differences cannot corrupt it.
      const { data, error } = await supabase
        .from("task_logs")
        .update({ payment_status })
        .eq("id", id)
        .select("*, projects(id, name)")
        .single();

      if (error) {
        const raw = error.message.toLowerCase();
        if (raw.includes("payment_status") || raw.includes("paid_at")) {
          throw new Error("PAYMENT_STATUS_UNAVAILABLE");
        }
        throw error;
      }
      return mapLog(data as Record<string, unknown>);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["task_logs"] });
      void qc.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}

export function useDeleteTaskLog() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("task_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["task_logs"] });
      void qc.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}
