"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        ...data,
        global_hourly_rate: Number(data.global_hourly_rate),
      } as Profile;
    },
  });
}

export function useUpdateHourlyRate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (rate: number) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
       if (!user) throw new Error("AUTH_REQUIRED");

      const { data, error } = await supabase
        .from("profiles")
        .update({ global_hourly_rate: rate })
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;
      return {
        ...data,
        global_hourly_rate: Number(data.global_hourly_rate),
      } as Profile;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
