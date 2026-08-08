"use client";

import { useMemo, useState } from "react";
import { Terminal, Timer, Wallet } from "lucide-react";
import { TerminalInput, TerminalSelect } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useProjects } from "@/hooks/useProjects";
import { useProfile } from "@/hooks/useProfile";
import { useCreateTaskLog } from "@/hooks/useTaskLogs";
import { computePreview, resolveEarningsUsd } from "@/lib/earnings";
import { formatAhtMinutes, formatHours } from "@/lib/formatters";
import { useCurrency, useI18n } from "@/components/providers/PreferencesProvider";
import { getUserError } from "@/lib/errors";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function TaskLogForm() {
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: profile } = useProfile();
  const createLog = useCreateTaskLog();
  const { t, localeCode } = useI18n();
  const { formatMoney, displayCurrency } = useCurrency();

  const activeProjects = useMemo(
    () => (projects ?? []).filter((p) => p.status !== "archived"),
    [projects],
  );

  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState(todayISO);
  const [att, setAtt] = useState(0);
  const [rev, setRev] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const selected =
    activeProjects.find((p) => p.id === projectId) ??
    activeProjects[0] ??
    null;

  const effectiveProjectId = projectId || selected?.id || "";

  const preview = useMemo(() => {
    if (!selected || !profile) {
      return { hours: 0, earnings: 0 };
    }
    return computePreview(
      att,
      rev,
      selected.current_aht_attempter,
      selected.current_aht_reviewer,
      profile.global_hourly_rate,
    );
  }, [att, rev, selected, profile]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);

    if (!effectiveProjectId) {
       setError(t("errors.projectRequired"));
      return;
    }
    if (att < 0 || rev < 0) {
       setError(t("errors.tasksNegative"));
      return;
    }

    try {
      const row = await createLog.mutateAsync({
        project_id: effectiveProjectId,
        date,
        tasks_attempter: att,
        tasks_reviewer: rev,
      });
       setOk(
         t("logs.committed", {
            amount: formatMoney(
              resolveEarningsUsd(
                row.calculated_earnings_usd,
                row.calculated_earnings,
              ),
            ),
           currency: displayCurrency,
         }),
       );
      setAtt(0);
      setRev(0);
    } catch (err) {
       setError(getUserError(err, t, "errors.commitFailed"));
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="lg:col-span-8 flex flex-col gap-6 glass-panel p-6 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-12 zebra-stripe pointer-events-none" />
        <h2 className="font-sans text-headline-md text-on-surface flex items-center gap-2 relative z-10">
          <Terminal className="h-5 w-5 text-primary-container" />
           {t("logs.entryConsole")}
        </h2>

        <div className="flex flex-col gap-5 mt-2 relative z-10">
           <TerminalSelect
             id="task-project"
             name="project_id"
             label={t("logs.selectProject")}
            value={effectiveProjectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={projectsLoading || activeProjects.length === 0}
          >
            {activeProjects.length === 0 ? (
               <option value="">
                 {projectsLoading ? t("common.loading") : t("logs.noActiveProjects")}
               </option>
            ) : (
              activeProjects.map((p) => (
                <option key={p.id} value={p.id} className="bg-anthracite">
                  {p.name}
                </option>
              ))
            )}
          </TerminalSelect>

           <TerminalInput
             id="task-date"
             name="date"
             label={t("logs.workDate")}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <TerminalInput
               id="tasks-attempter"
               name="tasks_attempter"
               label={t("logs.attempterTasks")}
              type="number"
              min={0}
              step={1}
              value={att}
              onChange={(e) => setAtt(Math.max(0, Number(e.target.value) || 0))}
              className="text-secondary-container text-data-lg font-bold"
            />
             <TerminalInput
               id="tasks-reviewer"
               name="tasks_reviewer"
               label={t("logs.reviewerTasks")}
              type="number"
              min={0}
              step={1}
              value={rev}
              onChange={(e) => setRev(Math.max(0, Number(e.target.value) || 0))}
              className="text-secondary-container text-data-lg font-bold"
            />
          </div>

          {att === 0 && rev === 0 ? (
            <p className="font-mono text-[11px] text-outline">
               {t("logs.zeroYield")}
            </p>
          ) : null}

          {error ? (
            <div className="border-l-2 border-error-bright bg-error-container/20 px-3 py-2">
              <p className="font-mono text-[12px] text-error-bright">{error}</p>
            </div>
          ) : null}
          {ok ? (
            <div className="border-l-2 border-tertiary bg-tertiary/10 px-3 py-2">
              <p className="font-mono text-[12px] text-tertiary">{ok}</p>
            </div>
          ) : null}

          <div className="flex justify-end mt-2 pt-4 border-t border-outline-variant/30">
            <Button
              type="submit"
              variant="secondary"
              loading={createLog.isPending}
              disabled={!effectiveProjectId}
              className="px-6"
            >
               {t("logs.commit")}
            </Button>
          </div>
        </div>
      </form>

      <div className="lg:col-span-4 flex flex-col gap-4">
        <div className="bg-surface-card border border-outline-variant/50 p-6 flex flex-col gap-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-secondary-container/5 blur-2xl" />
          <h3 className="font-mono text-label-caps text-on-surface-variant uppercase tracking-widest flex items-center justify-between">
             {t("logs.currentAht")}
            <Timer className="h-4 w-4" />
          </h3>
          <div className="mt-4 space-y-3">
            <div>
               <p className="font-mono text-[10px] text-outline">{t("logs.attempter")}</p>
              <p className="font-mono text-2xl text-secondary-container font-bold">
                {selected
                   ? formatAhtMinutes(selected.current_aht_attempter, localeCode)
                  : "—"}
              </p>
            </div>
            <div>
               <p className="font-mono text-[10px] text-outline">{t("logs.reviewer")}</p>
              <p className="font-mono text-2xl text-on-surface font-bold">
                {selected
                   ? formatAhtMinutes(selected.current_aht_reviewer, localeCode)
                  : "—"}
              </p>
            </div>
          </div>
          <div className="w-full h-1 bg-[#1a1a1a] mt-4 relative">
            <div className="absolute top-0 left-0 h-full bg-cyan-neon w-[65%] shadow-[0_0_8px_rgba(0,240,255,0.5)]">
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-neon-success shadow-[0_0_4px_#2ae500]" />
            </div>
          </div>
        </div>

        <div className="bg-surface-card border border-outline-variant/50 p-6 flex flex-col gap-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-tertiary/5 blur-2xl" />
          <h3 className="font-mono text-label-caps text-on-surface-variant uppercase tracking-widest flex items-center justify-between">
             {t("logs.sessionYield")}
            <Wallet className="h-4 w-4" />
          </h3>
          <div className="flex items-end gap-2 mt-4">
            <span className="font-mono text-[40px] leading-none font-bold text-tertiary drop-shadow-[0_0_8px_rgba(42,229,0,0.3)]">
               +{formatMoney(preview.earnings)}
            </span>
          </div>
          <p className="font-mono text-data-sm text-on-surface-variant mt-2">
             {formatHours(preview.hours, localeCode)} @ {formatMoney(profile?.global_hourly_rate ?? 0)} / {t("common.perHour")}
          </p>
          <div className="font-mono text-data-sm text-on-surface-variant mt-1 flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-tertiary animate-pulse" />
             {t("logs.livePreview", { currency: displayCurrency })}
          </div>
        </div>
      </div>
    </div>
  );
}
