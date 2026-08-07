"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Project, ProjectInsert, ProjectUpdate } from "@/types";

function mapProject(row: Record<string, unknown>): Project {
  return {
    ...(row as unknown as Project),
    current_aht_attempter: Number(row.current_aht_attempter),
    current_aht_reviewer: Number(row.current_aht_reviewer),
  };
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async (): Promise<Project[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map((r) => mapProject(r as Record<string, unknown>));
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: Omit<ProjectInsert, "user_id">,
    ): Promise<Project> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("projects")
        .insert({ ...input, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return mapProject(data as Record<string, unknown>);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: ProjectUpdate & { id: string }): Promise<Project> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("projects")
        .update(patch)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return mapProject(data as Record<string, unknown>);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["projects"] });
      void qc.invalidateQueries({ queryKey: ["task_logs"] });
      void qc.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}
