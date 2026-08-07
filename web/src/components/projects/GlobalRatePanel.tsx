"use client";

import { useEffect, useState } from "react";
import { useProfile, useUpdateHourlyRate } from "@/hooks/useProfile";
import { Button } from "@/components/ui/Button";

export function GlobalRatePanel() {
  const { data: profile, isLoading } = useProfile();
  const update = useUpdateHourlyRate();
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
      setMsg("Invalid rate");
      return;
    }
    try {
      await update.mutateAsync(n);
      setMsg("SYNCED");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Sync failed");
    }
  }

  return (
    <div className="glass-panel p-4 cyber-border flex items-center gap-4 min-w-[250px]">
      <div className="flex flex-col flex-1">
        <label className="font-mono text-label-caps text-secondary-container mb-1">
          GLOBAL_RATE_HR
        </label>
        <div className="flex items-center font-mono text-data-lg">
          <span className="text-secondary-container mr-1">&gt;</span>
          <span className="text-on-surface mr-1">$</span>
          <input
            className="terminal-input w-24 p-0 font-mono text-data-lg focus:ring-0"
            type="number"
            min={0}
            step="0.01"
            disabled={isLoading}
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </div>
        {msg ? (
          <span className="font-mono text-[10px] text-outline mt-1">{msg}</span>
        ) : null}
      </div>
      <Button
        type="button"
        onClick={() => void sync()}
        loading={update.isPending}
        className="px-3 py-1 text-sm self-end"
      >
        SYNC
      </Button>
    </div>
  );
}
