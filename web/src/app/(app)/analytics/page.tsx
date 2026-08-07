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
import {
  downloadBlob,
  exportTaskLogs,
} from "@/lib/api";
import {
  formatAhtSeconds,
  formatCurrency,
  hoursFromLog,
} from "@/lib/earnings";
import type { GroupBy } from "@/types";

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
    calculated_earnings: number;
  }[],
): string {
  const header = [
    "date",
    "project",
    "tasks_attempter",
    "tasks_reviewer",
    "snapshot_aht_attempter_sec",
    "snapshot_aht_reviewer_sec",
    "hourly_rate",
    "hours",
    "earnings",
  ];
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
      Number(l.calculated_earnings).toFixed(4),
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
        setExportMsg("EXPORT_OK // API");
      } catch {
        const logs = logsQuery.data ?? [];
        const csv = buildClientCsv(logs);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        downloadBlob(blob, "task_logs.csv");
        setExportMsg("EXPORT_OK // CLIENT_FALLBACK");
      }
    } catch (err) {
      setExportMsg(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="font-sans text-headline-lg-mobile md:text-headline-lg text-primary-fixed">
          Analytics Dashboard
        </h1>
        <div className="flex flex-wrap items-center gap-3 glass-panel p-2 cyber-border">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-primary-container" />
            <select
              className="terminal-input py-1 text-sm bg-transparent border-none w-auto min-w-[120px]"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="" className="bg-anthracite">
                All Projects
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
          >
            <option value="month" className="bg-anthracite">
              By Month
            </option>
            <option value="project" className="bg-anthracite">
              By Project
            </option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <TerminalInput
          label="DATE_FROM"
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <TerminalInput
          label="DATE_TO"
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
            EXPORT CSV
          </Button>
          {data?.source ? (
            <Badge tone={data.source === "api" ? "info" : "warning"}>
              SRC:{data.source.toUpperCase()}
            </Badge>
          ) : null}
          {exportMsg ? (
            <span className="font-mono text-[11px] text-outline">{exportMsg}</span>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="font-mono text-data-sm text-error-bright">
          {error instanceof Error ? error.message : "Analytics error"}
        </p>
      ) : null}

      <KpiCards kpis={data?.kpis} loading={isLoading} />

      <EarningsChart series={data?.series} loading={isLoading} />

      {data?.series && data.series.length > 0 ? (
        <div className="bg-surface-card cyber-border overflow-hidden">
          <div className="p-4 border-b border-outline-variant zebra-stripe">
            <h3 className="font-sans text-headline-md text-on-surface">
              Series Breakdown
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead>
                <tr className="bg-anthracite border-b border-electric font-mono text-label-caps text-outline">
                  <th className="p-3 font-normal">KEY</th>
                  <th className="p-3 font-normal text-right">EARNINGS</th>
                  <th className="p-3 font-normal text-right">ATT</th>
                  <th className="p-3 font-normal text-right">REV</th>
                  <th className="p-3 font-normal text-right">HOURS</th>
                </tr>
              </thead>
              <tbody className="font-mono text-data-sm">
                {data.series.map((s) => (
                  <tr key={s.key} className="zebra-row">
                    <td className="p-3 text-primary-fixed">{s.label}</td>
                    <td className="p-3 text-right text-secondary-container">
                      {formatCurrency(s.earnings)}
                    </td>
                    <td className="p-3 text-right">{s.tasks_attempter}</td>
                    <td className="p-3 text-right">{s.tasks_reviewer}</td>
                    <td className="p-3 text-right text-on-surface-variant">
                      {s.hours.toFixed(2)}h
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
          Recent Activity Log
        </h3>
        <p className="font-mono text-[10px] text-outline mb-2">
          AHT values shown are immutable snapshots (e.g.{" "}
          {formatAhtSeconds(90)}) — never recomputed from current project AHT.
        </p>
        <TaskLogList limit={20} />
      </div>
    </div>
  );
}
