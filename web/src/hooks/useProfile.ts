"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { OnboardingStatus, Profile } from "@/types";

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

export function useUpdateOnboardingStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (status: OnboardingStatus): Promise<OnboardingStatus> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("AUTH_REQUIRED");

      const { data, error } = await supabase
        .from("profiles")
        .update({ onboarding_status: status })
        .eq("id", user.id)
        .select("onboarding_status")
        .single();

      if (error) throw error;
      return data.onboarding_status as OnboardingStatus;
    },
    onSuccess: (status) => {
      qc.setQueryData<Profile | null>(["profile"], (profile) =>
        profile ? { ...profile, onboarding_status: status } : profile,
      );
      void qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
