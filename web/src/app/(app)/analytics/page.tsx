"use client";

import { useMemo, useState } from "react";
import { Download, Filter } from "lucide-react";
import { KpiCards } from "@/components/kpis/KpiCards";
import { EarningsChart } from "@/components/charts/EarningsChart";
import { TaskLogList } from "@/components/tasks/TaskLogList";
import { TerminalInput } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useProjects } from "@/hooks/useProjects";
import { useAllTaskLogs } from "@/hooks/useTaskLogs";
import { downloadBlob, exportTaskLogs } from "@/lib/api";
import { hoursFromLog, resolveEarningsUsd } from "@/lib/earnings";
import { formatAhtMinutes, formatHours } from "@/lib/formatters";
import type { GroupBy } from "@/types";
import { useCurrency, useI18n } from "@/components/providers/PreferencesProvider";
import { getUserError } from "@/lib/errors";

function buildClientCsv(
  logs: {
    date: string;
    projects?: { name: string } | null;
    project_id: string;
    tasks_attempter: number;
    tasks_reviewer: number;
    snapshot_aht_attempter: number;
    snapshot_aht_reviewer: number;
    hourly_rate_used: number;
    calculated_earnings_usd?: number;
    calculated_earnings: number;
  }[],
  headers: string[],
): string {
  const header = headers;
  const rows = logs.map((l) => {
    const hours = hoursFromLog(l);
    return [
      l.date,
      l.projects?.name ?? l.project_id,
      l.tasks_attempter,
      l.tasks_reviewer,
      l.snapshot_aht_attempter,
      l.snapshot_aht_reviewer,
      l.hourly_rate_used,
      hours.toFixed(6),
        resolveEarningsUsd(
          l.calculated_earnings_usd,
          l.calculated_earnings,
        ).toFixed(4),
    ].join(",");
  });
  return [header.join(","), ...rows].join("\n");
}

export default function AnalyticsPage() {
  const { data: projects } = useProjects();
  const [projectId, setProjectId] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const { t, localeCode } = useI18n();
  const { formatMoney, displayCurrency } = useCurrency();

  const filters = useMemo(
    () => ({
      project_id: projectId || null,
      date_from: dateFrom || null,
      date_to: dateTo || null,
      group_by: groupBy,
    }),
    [projectId, dateFrom, dateTo, groupBy],
  );

  const { data, isLoading, error } = useAnalytics(filters);
  const logsQuery = useAllTaskLogs(filters);

  async function onExport() {
    setExporting(true);
    setExportMsg(null);
    try {
      try {
        const blob = await exportTaskLogs({ ...filters, format: "csv" });
        downloadBlob(blob, "task_logs.csv");
         setExportMsg(t("analytics.exportOkApi"));
      } catch {
         const logs = logsQuery.data ?? [];
         const csv = buildClientCsv(logs, [
           t("analytics.exportDate"),
           t("analytics.exportProject"),
           t("analytics.exportAttempter"),
           t("analytics.exportReviewer"),
           t("analytics.exportAttempterAht"),
           t("analytics.exportReviewerAht"),
           t("analytics.exportHourlyRate"),
           t("analytics.exportHours"),
           t("analytics.exportEarnings"),
         ]);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        downloadBlob(blob, "task_logs.csv");
         setExportMsg(t("analytics.exportOkClient"));
      }
    } catch (err) {
       setExportMsg(getUserError(err, t, "errors.exportFailed"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="font-sans text-headline-lg-mobile md:text-headline-lg text-primary-fixed">
           {t("analytics.title")}
        </h1>
        <div className="flex flex-wrap items-center gap-3 glass-panel p-2 cyber-border">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-primary-container" />
            <select
              className="terminal-input py-1 text-sm bg-transparent border-none w-auto min-w-[120px]"
               value={projectId}
               onChange={(e) => setProjectId(e.target.value)}
               aria-label={t("analytics.allProjects")}
            >
              <option value="" className="bg-anthracite">
                 {t("analytics.allProjects")}
              </option>
              {(projects ?? []).map((p) => (
                <option key={p.id} value={p.id} className="bg-anthracite">
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="h-4 w-px bg-outline-variant hidden sm:block" />
          <select
            className="terminal-input py-1 text-sm bg-transparent border-none w-auto"
             value={groupBy}
             onChange={(e) => setGroupBy(e.target.value as GroupBy)}
             aria-label={t("analytics.groupBy")}
          >
            <option value="month" className="bg-anthracite">
               {t("analytics.byMonth")}
            </option>
            <option value="project" className="bg-anthracite">
               {t("analytics.byProject")}
            </option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
         <TerminalInput
           id="analytics-date-from"
           name="date_from"
           label={t("analytics.dateFrom")}
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
         <TerminalInput
           id="analytics-date-to"
           name="date_to"
           label={t("analytics.dateTo")}
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
        <div className="sm:col-span-2 flex items-end gap-3">
          <Button
            type="button"
            variant="secondary"
            loading={exporting}
            onClick={() => void onExport()}
            className="gap-2"
          >
            <Download className="h-3.5 w-3.5" />
             {t("analytics.export")}
          </Button>
           {data?.source ? (
             <div className="flex flex-wrap items-center gap-2">
               <Badge tone={data.source === "api" ? "info" : "warning"}>
                  SRC:{" "}{data.source === "api" ? t("analytics.sourceApi") : t("analytics.sourceClient")}
               </Badge>
               <span className="font-mono text-[10px] text-outline">
                 {data.source === "api"
                   ? t("analytics.sourceApiStatus")
                   : t("analytics.sourceClientStatus")}
               </span>
             </div>
           ) : null}
          {exportMsg ? (
            <span className="font-mono text-[11px] text-outline">{exportMsg}</span>
          ) : null}
        </div>
      </div>

       {error ? (
         <div className="border border-error-bright/40 bg-error-container/20 px-4 py-3">
           <p className="font-mono text-label-caps text-error-bright">
             {t("analytics.unavailableTitle")}
           </p>
           <p className="font-mono text-data-sm text-error-bright mt-1">
             {getUserError(error, t, "errors.analyticsUnavailable")}
           </p>
         </div>
       ) : null}

       {!error && data && data.series.length === 0 ? (
         <div className="border border-outline-variant/40 bg-surface-card px-4 py-3">
           <p className="font-mono text-label-caps text-on-surface-variant">
             {t("analytics.noLogsTitle")}
           </p>
           <p className="font-mono text-data-sm text-outline mt-1">
             {t("analytics.noLogsDescription")}
           </p>
         </div>
       ) : null}

       <KpiCards kpis={data?.kpis} loading={isLoading || !!error} />

       <EarningsChart series={data?.series} loading={isLoading || !!error} />

      {data?.series && data.series.length > 0 ? (
        <div className="bg-surface-card cyber-border overflow-hidden">
          <div className="p-4 border-b border-outline-variant zebra-stripe">
            <h3 className="font-sans text-headline-md text-on-surface">
               {t("analytics.seriesBreakdown")}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead>
                <tr className="bg-anthracite border-b border-electric font-mono text-label-caps text-outline">
                   <th className="p-3 font-normal">{t("analytics.key")}</th>
                   <th className="p-3 font-normal text-right">{t("analytics.earnings")} ({displayCurrency})</th>
                   <th className="p-3 font-normal text-right">{t("analytics.att")}</th>
                   <th className="p-3 font-normal text-right">{t("analytics.rev")}</th>
                   <th className="p-3 font-normal text-right">{t("analytics.hours")}</th>
                </tr>
              </thead>
              <tbody className="font-mono text-data-sm">
                 {data.series.map((point) => (
                   <tr key={point.key} className="zebra-row">
                     <td className="p-3 text-primary-fixed">{point.label}</td>
                     <td className="p-3 text-right text-secondary-container">
                       {formatMoney(point.earnings)}
                     </td>
                     <td className="p-3 text-right">{point.tasks_attempter}</td>
                     <td className="p-3 text-right">{point.tasks_reviewer}</td>
                     <td className="p-3 text-right text-on-surface-variant">
                       {formatHours(point.hours, localeCode)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div>
        <h3 className="font-mono text-label-caps text-on-surface-variant uppercase tracking-widest mb-4">
           {t("analytics.recentActivity")}
        </h3>
        <p className="font-mono text-[10px] text-outline mb-2">
           {t("analytics.snapshotNote", {
             example: formatAhtMinutes(1.5, localeCode),
           })}
        </p>
        <TaskLogList limit={20} />
      </div>
    </div>
  );
}
