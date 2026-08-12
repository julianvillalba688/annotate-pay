"use client";

import { useEffect, useState } from "react";
import { useProfile, useUpdateHourlyRate } from "@/hooks/useProfile";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/components/providers/PreferencesProvider";
import { getUserError } from "@/lib/errors";

export function GlobalRatePanel() {
  const { data: profile, isLoading, error: profileError } = useProfile();
  const update = useUpdateHourlyRate();
  const { t } = useI18n();
  const [rate, setRate] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setRate(String(profile.global_hourly_rate ?? 0));
    }
  }, [profile]);

  async function sync() {
    setMsg(null);
    const n = Number(rate);
    if (!Number.isFinite(n) || n < 0) {
       setMsg(t("errors.invalidRate"));
      return;
    }
    try {
      await update.mutateAsync(n);
       setMsg(t("projects.synced"));
    } catch (err) {
       setMsg(getUserError(err, t, "errors.syncFailed"));
    }
  }

  return (
    <div className="glass-panel p-4 cyber-border flex items-center gap-4 min-w-[250px]">
      <div className="flex flex-col flex-1">
         <label
           htmlFor="global-rate"
           className="font-mono text-label-caps text-secondary-container mb-1"
         >
           {t("projects.globalRate")}
        </label>
        <div className="flex items-center font-mono text-data-lg">
          <span className="text-secondary-container mr-1">&gt;</span>
           <span className="text-on-surface mr-1">{t("common.usd")}</span>
          <input
           className="terminal-input w-24 p-0 font-mono text-data-lg focus:ring-0"
           id="global-rate"
            data-onboarding-target="rate-field"
            type="number"
            min={0}
            step="0.01"
            disabled={isLoading}
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            aria-label={t("projects.globalRate")}
          />
        </div>
        <span className="font-mono text-[10px] text-outline mt-1">
          {t("projects.globalRateHint")}
        </span>
        {msg ? (
          <span className="font-mono text-[10px] text-outline mt-1">{msg}</span>
        ) : null}
        {profileError ? (
          <span className="font-mono text-[10px] text-error-bright mt-1">
            {getUserError(profileError, t, "errors.loadFailed")}
          </span>
        ) : null}
      </div>
       <Button
         type="button"
         data-onboarding-target="rate-sync"
         onClick={() => void sync()}
        loading={update.isPending}
        className="px-3 py-1 text-sm self-end"
      >
         {t("projects.sync")}
      </Button>
    </div>
  );
}
