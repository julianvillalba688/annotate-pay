"use client";

import { Receipt, Trash2 } from "lucide-react";
import { useDeleteTaskLog, useTaskLogs } from "@/hooks/useTaskLogs";
import {
  formatAhtSeconds,
  formatCurrency,
  hoursFromLog,
  formatHours,
} from "@/lib/earnings";
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export function TaskLogList({ limit = 30 }: { limit?: number }) {
  const { data, isLoading, error } = useTaskLogs(limit);
  const del = useDeleteTaskLog();

  if (isLoading) return <LoadingBlock label="FETCHING_TRANSMISSIONS..." />;
  if (error)
    return (
      <ErrorBlock
        message={error instanceof Error ? error.message : "Load failed"}
      />
    );

  if (!data?.length) {
    return (
      <div className="border border-outline-variant/30 bg-anthracite">
        <EmptyState
          title="NO LOGS COMMITTED"
          subtitle="Use the Task Entry Console to record work."
          icon={<Receipt className="h-8 w-8" />}
        />
      </div>
    );
  }

  return (
    <div className="border border-outline-variant/30 overflow-hidden bg-anthracite">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[720px]">
          <thead>
            <tr className="bg-[#0a0a0a] border-b border-electric text-outline font-mono text-label-caps">
              <th className="p-3 font-normal">DATE</th>
              <th className="p-3 font-normal">PROJECT</th>
              <th className="p-3 font-normal text-right">ATT</th>
              <th className="p-3 font-normal text-right">REV</th>
              <th className="p-3 font-normal text-right">AHT SNAP</th>
              <th className="p-3 font-normal text-right">HOURS</th>
              <th className="p-3 font-normal text-right">EARNINGS</th>
              <th className="p-3 font-normal text-center">DEL</th>
            </tr>
          </thead>
          <tbody className="font-mono text-data-sm">
            {data.map((log) => {
              const hours = hoursFromLog(log);
              return (
                <tr
                  key={log.id}
                  className="zebra-row border-b border-transparent hover:border-outline-variant transition-colors"
                >
                  <td className="p-3 text-on-surface-variant">{log.date}</td>
                  <td className="p-3 text-primary-fixed">
                    {log.projects?.name ?? log.project_id.slice(0, 8)}
                  </td>
                  <td className="p-3 text-right text-on-surface">
                    {log.tasks_attempter}
                  </td>
                  <td className="p-3 text-right text-on-surface">
                    {log.tasks_reviewer}
                  </td>
                  <td className="p-3 text-right text-on-surface-variant">
                    <span className="block">
                      A {formatAhtSeconds(log.snapshot_aht_attempter)}
                    </span>
                    <span className="block text-[11px]">
                      R {formatAhtSeconds(log.snapshot_aht_reviewer)}
                    </span>
                  </td>
                  <td className="p-3 text-right text-on-surface-variant">
                    {formatHours(hours)}
                  </td>
                  <td className="p-3 text-right text-secondary-container font-bold">
                    {formatCurrency(log.calculated_earnings)}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      title="Delete log"
                      disabled={del.isPending}
                      onClick={() => {
                        if (
                          confirm(
                            "Delete this transmission? This cannot be undone.",
                          )
                        ) {
                          void del.mutateAsync(log.id);
                        }
                      }}
                      className="text-error hover:text-error-bright transition-colors p-1"
                    >
                      <Trash2 className="h-4 w-4 inline" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 border-t border-outline-variant/30 flex items-center gap-2">
        <Badge tone="info">SNAPSHOT_LOCKED</Badge>
        <span className="font-mono text-[10px] text-outline">
          Earnings from frozen AHT + rate at commit time
        </span>
      </div>
    </div>
  );
}
