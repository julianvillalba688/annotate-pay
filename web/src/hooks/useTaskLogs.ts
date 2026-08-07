"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { TaskLog } from "@/types";

function mapLog(row: Record<string, unknown>): TaskLog {
  return {
    ...(row as unknown as TaskLog),
    tasks_attempter: Number(row.tasks_attempter) || 0,
    tasks_reviewer: Number(row.tasks_reviewer) || 0,
    snapshot_aht_attempter: Number(row.snapshot_aht_attempter) || 0,
    snapshot_aht_reviewer: Number(row.snapshot_aht_reviewer) || 0,
    hourly_rate_used: Number(row.hourly_rate_used) || 0,
    calculated_earnings: Number(row.calculated_earnings) || 0,
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

      if (error) throw error;
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
    mutationFn: async (input: {
      project_id: string;
      date: string;
      tasks_attempter: number;
      tasks_reviewer: number;
    }): Promise<TaskLog> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // DB trigger freezes snapshots + calculates earnings.
      // Placeholder snapshot values satisfy NOT NULL before trigger runs.
      const { data, error } = await supabase
        .from("task_logs")
        .insert({
          user_id: user.id,
          project_id: input.project_id,
          date: input.date,
          tasks_attempter: input.tasks_attempter,
          tasks_reviewer: input.tasks_reviewer,
          snapshot_aht_attempter: 0,
          snapshot_aht_reviewer: 0,
          hourly_rate_used: 0,
        })
        .select("*, projects(id, name)")
        .single();

      if (error) throw error;
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
