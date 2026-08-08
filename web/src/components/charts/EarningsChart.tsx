"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsSeriesPoint } from "@/types";
import { formatNumber } from "@/lib/formatters";
import { EmptyState } from "@/components/ui/Card";
import { BarChart3 } from "lucide-react";
import { useCurrency, useI18n } from "@/components/providers/PreferencesProvider";

interface EarningsChartProps {
  series?: AnalyticsSeriesPoint[];
  loading?: boolean;
}

export function EarningsChart({ series, loading }: EarningsChartProps) {
  const { t, localeCode } = useI18n();
  const { formatMoney, displayCurrency } = useCurrency();
  const rawData = (series ?? []).map((p) => ({
    ...p,
    tasks: p.tasks_attempter + p.tasks_reviewer,
  }));
  const hasPaymentSeries =
    rawData.length > 0 &&
    rawData.every(
      (point) =>
        typeof point.paid === "number" && typeof point.pending === "number",
    );
  const data = rawData;
  const earningsLabel = t("chart.earnings", { currency: displayCurrency });
  const paidLabel = t("chart.paid", { currency: displayCurrency });
  const pendingLabel = t("chart.pending", { currency: displayCurrency });
  const tasksLabel = t("chart.tasks");

  return (
    <div className="bg-surface-card cyber-border p-6 relative overflow-hidden">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <h2 className="font-sans text-headline-md text-primary-fixed">
          {t("chart.title")}
        </h2>
        <div className="flex gap-2 items-center">
          {hasPaymentSeries ? (
            <>
              <span className="w-3 h-3 bg-tertiary shadow-[0_0_8px_#2ae500]" />
              <span className="font-mono text-data-sm text-outline">{paidLabel}</span>
              <span className="w-3 h-3 bg-primary-container shadow-[0_0_8px_#9d00ff] ml-4" />
              <span className="font-mono text-data-sm text-outline">{pendingLabel}</span>
            </>
          ) : (
            <>
              <span className="w-3 h-3 bg-primary-container shadow-[0_0_8px_#9d00ff]" />
              <span className="font-mono text-data-sm text-outline">{earningsLabel}</span>
            </>
          )}
          <span className="w-3 h-3 bg-secondary-container shadow-[0_0_8px_#00eefc] ml-4" />
          <span className="font-mono text-data-sm text-outline">{tasksLabel}</span>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <span className="font-mono text-data-sm text-secondary-container animate-pulse">
            {t("chart.rendering")}
          </span>
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          title={t("chart.noData")}
          subtitle={t("chart.noDataDescription")}
          icon={<BarChart3 className="h-8 w-8" />}
        />
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4e4356" strokeOpacity={0.35} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#9a8ca2", fontSize: 11, fontFamily: "Space Mono" }}
                axisLine={{ stroke: "#4e4356" }}
                tickLine={false}
              />
              <YAxis
                yAxisId="earn"
                tick={{ fill: "#9a8ca2", fontSize: 11, fontFamily: "Space Mono" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => formatMoney(v, 0)}
              />
              <YAxis
                yAxisId="tasks"
                orientation="right"
                tick={{ fill: "#9a8ca2", fontSize: 11, fontFamily: "Space Mono" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#121212",
                  border: "1px solid rgba(157,0,255,0.4)",
                  borderRadius: 0,
                  fontFamily: "Space Mono",
                  fontSize: 12,
                }}
                labelStyle={{ color: "#dfb7ff" }}
                formatter={(value, name) => {
                  const n = typeof value === "number" ? value : Number(value) || 0;
                  if (name === earningsLabel || name === paidLabel || name === pendingLabel) {
                    return [formatMoney(n), String(name)];
                  }
                  if (name === tasksLabel) return [formatNumber(n, localeCode), tasksLabel];
                  return [String(value ?? ""), String(name ?? "")];
                }}
              />
              <Legend
                wrapperStyle={{
                  fontFamily: "Space Mono",
                  fontSize: 11,
                  color: "#9a8ca2",
                }}
              />
              {hasPaymentSeries ? (
                <>
                  <Bar
                    yAxisId="earn"
                    dataKey="pending"
                    name={pendingLabel}
                    stackId="earnings"
                    fill="#9D00FF"
                    fillOpacity={0.85}
                    maxBarSize={36}
                  />
                  <Bar
                    yAxisId="earn"
                    dataKey="paid"
                    name={paidLabel}
                    stackId="earnings"
                    fill="#2AE500"
                    fillOpacity={0.85}
                    maxBarSize={36}
                  />
                </>
              ) : (
                <Bar
                  yAxisId="earn"
                  dataKey="earnings"
                  name={earningsLabel}
                  fill="#9D00FF"
                  fillOpacity={0.85}
                  maxBarSize={36}
                />
              )}
              <Line
                yAxisId="tasks"
                type="monotone"
                dataKey="tasks"
                name={tasksLabel}
                stroke="#00F0FF"
                strokeWidth={2}
                dot={{ r: 3, fill: "#00F0FF" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
