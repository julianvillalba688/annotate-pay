"use client";

import { useState } from "react";
import { Receipt, Trash2 } from "lucide-react";
import {
  useDeleteTaskLog,
  useTaskLogs,
  useUpdateTaskLogPaymentStatus,
} from "@/hooks/useTaskLogs";
import { hoursFromLog, resolveEarningsUsd } from "@/lib/earnings";
import { formatAhtMinutes, formatDate, formatHours } from "@/lib/formatters";
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useCurrency, useI18n } from "@/components/providers/PreferencesProvider";
import { getUserError } from "@/lib/errors";
import type { PaymentStatus } from "@/types";

function paymentTone(status: PaymentStatus) {
  return status === "paid" ? ("success" as const) : ("warning" as const);
}

export function TaskLogList({ limit = 30 }: { limit?: number }) {
  const { data, isLoading, error } = useTaskLogs(limit);
  const del = useDeleteTaskLog();
  const updateStatus = useUpdateTaskLogPaymentStatus();
  const { t, localeCode } = useI18n();
  const { formatMoney, displayCurrency } = useCurrency();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const paymentStatusUnavailable = Boolean(
    data?.some((log) => log.payment_status_available === false),
  );

  if (isLoading) return <LoadingBlock label={t("logs.fetching")} />;
  if (error)
    return (
      <ErrorBlock
        message={getUserError(error, t, "errors.loadFailed")}
      />
    );

  if (!data?.length) {
    return (
      <div className="border border-outline-variant/30 bg-anthracite">
        <EmptyState
          title={t("logs.noLogs")}
          subtitle={t("logs.noLogsDescription")}
          icon={<Receipt className="h-8 w-8" />}
        />
      </div>
    );
  }

  return (
    <div className="border border-outline-variant/30 overflow-hidden bg-anthracite">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-[#0a0a0a] border-b border-electric text-outline font-mono text-label-caps">
              <th className="p-3 font-normal">{t("logs.workDate")}</th>
              <th className="p-3 font-normal">{t("logs.project")}</th>
              <th className="p-3 font-normal text-right">{t("logs.att")}</th>
              <th className="p-3 font-normal text-right">{t("logs.rev")}</th>
              <th className="p-3 font-normal text-right">{t("logs.ahtDisplay")}</th>
               <th className="p-3 font-normal text-right">{t("analytics.hours")}</th>
               <th className="p-3 font-normal text-right whitespace-nowrap">{t("analytics.earnings")} ({displayCurrency})</th>
               <th className="p-3 font-normal text-center">{t("logs.paymentStatus")}</th>
               <th className="p-3 font-normal text-center">{t("common.delete")}</th>
            </tr>
          </thead>
          <tbody className="font-mono text-data-sm">
            {data.map((log) => {
              const hours = hoursFromLog(log);
              const paymentStatusAvailable = log.payment_status_available !== false;
              const statusUpdating =
                updateStatus.isPending && updateStatus.variables?.id === log.id;
              return (
                <tr
                  key={log.id}
                  className="zebra-row border-b border-transparent hover:border-outline-variant transition-colors"
                >
                    <td className="p-3 text-on-surface-variant">
                      {formatDate(log.date, localeCode)}
                    </td>
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
                       A {formatAhtMinutes(log.snapshot_aht_attempter, localeCode)}
                    </span>
                    <span className="block text-[11px]">
                       R {formatAhtMinutes(log.snapshot_aht_reviewer, localeCode)}
                    </span>
                  </td>
                  <td className="p-3 text-right text-on-surface-variant">
                     {formatHours(hours, localeCode)}
                  </td>
                    <td className="p-3 text-right text-secondary-container font-bold whitespace-nowrap">
                      {formatMoney(
                        resolveEarningsUsd(
                          log.calculated_earnings_usd,
                          log.calculated_earnings,
                        ),
                      )}
                    </td>
                   <td className="p-3">
                     <div className="flex flex-col items-center gap-2">
                       <Badge tone={paymentTone(log.payment_status)}>
                         {t(`logs.${log.payment_status}Status`)}
                        </Badge>
                        <Button
                          type="button"
                          variant={
                            log.payment_status === "paid" ? "ghost" : "secondary"
                          }
                          loading={statusUpdating}
                          disabled={
                            !paymentStatusAvailable ||
                            (updateStatus.isPending &&
                              updateStatus.variables?.id !== log.id)
                          }
                         onClick={() => {
                           const nextStatus: PaymentStatus =
                             log.payment_status === "paid" ? "pending" : "paid";
                           setStatusError(null);
                           void updateStatus
                             .mutateAsync({
                               id: log.id,
                               payment_status: nextStatus,
                             })
                             .catch((err: unknown) => {
                               setStatusError(
                                 getUserError(
                                   err,
                                   t,
                                   "errors.paymentStatusUpdateFailed",
                                 ),
                               );
                             });
                         }}
                          className="px-2 py-1 text-[10px]"
                          aria-busy={statusUpdating}
                         aria-label={t(
                           log.payment_status === "paid"
                             ? "logs.markPending"
                             : "logs.markPaid",
                         )}
                       >
                          {statusUpdating
                            ? t("logs.paymentStatusUpdating")
                            : t(
                                log.payment_status === "paid"
                                  ? "logs.markPending"
                                  : "logs.markPaid",
                              )}
                       </Button>
                     </div>
                   </td>
                   <td className="p-3 text-center">
                    <button
                      type="button"
                       title={t("logs.deleteTitle")}
                       aria-label={t("logs.deleteTitle")}
                      disabled={del.isPending}
                      onClick={() => {
                         if (!confirm(t("logs.deleteConfirm"))) return;
                         setDeleteError(null);
                         void del.mutateAsync(log.id).catch((err: unknown) => {
                           setDeleteError(getUserError(err, t, "errors.deleteFailed"));
                         });
                      }}
                       className="text-error hover:text-error-bright transition-colors p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-error-bright"
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
        <div className="px-3 py-2 border-t border-outline-variant/30 flex flex-wrap items-center gap-2">
          <Badge tone="info">{t("logs.snapshotLocked")}</Badge>
          <span className="font-mono text-[10px] text-outline">
            {t("logs.frozenAtCommit")}
          </span>
          {paymentStatusUnavailable ? (
            <span className="font-mono text-[10px] text-primary">
              {t("logs.paymentStatusUnavailable")}
            </span>
          ) : null}
          {deleteError ? (
            <span className="font-mono text-[10px] text-error-bright">{deleteError}</span>
          ) : null}
          {statusError ? (
            <span className="font-mono text-[10px] text-error-bright" role="alert">
              {statusError}
            </span>
          ) : null}
       </div>
    </div>
  );
}
