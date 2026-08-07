"use client";

import {
  Clock,
  DollarSign,
  FileEdit,
  ListChecks,
} from "lucide-react";
import {
  formatCurrency,
  formatHours,
  formatNumber,
} from "@/lib/earnings";
import type { AnalyticsKpis } from "@/types";
import { cn } from "@/lib/utils";

interface KpiCardsProps {
  kpis?: AnalyticsKpis | null;
  loading?: boolean;
}

const CARDS = [
  {
    key: "earned" as const,
    label: "TOTAL EARNED",
    icon: DollarSign,
    accent: true,
  },
  {
    key: "att" as const,
    label: "ATTEMPTER TASKS",
    icon: FileEdit,
    accent: false,
  },
  {
    key: "rev" as const,
    label: "REVIEWER TASKS",
    icon: ListChecks,
    accent: false,
  },
  {
    key: "hours" as const,
    label: "HOURS INVESTED",
    icon: Clock,
    accent: false,
  },
];

export function KpiCards({ kpis, loading }: KpiCardsProps) {
  const values = {
    earned: formatCurrency(kpis?.total_earned ?? 0),
    att: formatNumber(kpis?.total_tasks_attempter ?? 0),
    rev: formatNumber(kpis?.total_tasks_reviewer ?? 0),
    hours: formatHours(kpis?.total_hours ?? 0),
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
      {CARDS.map(({ key, label, icon: Icon, accent }) => (
        <div
          key={key}
          className={cn(
            "bg-surface-card cyber-border p-4 flex flex-col justify-between min-h-[120px]",
            accent && "shadow-glow-cyan-sm",
          )}
        >
          <div className="flex justify-between items-start mb-2 border-b border-anthracite pb-2 zebra-stripe">
            <span className="font-mono text-label-caps text-outline">
              {label}
            </span>
            <Icon
              className={cn(
                "h-4 w-4",
                accent ? "text-secondary-container" : "text-primary-container",
              )}
            />
          </div>
          <div
            className={cn(
              "font-mono text-3xl my-2 font-bold tracking-tight",
              accent ? "text-secondary-container" : "text-on-surface",
              loading && "animate-pulse opacity-40",
            )}
          >
            {loading ? "—" : values[key]}
          </div>
          {key === "hours" && !loading ? (
            <div className="w-full h-2 bg-[#1A1A1A] mt-1 relative overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full bg-cyan-neon"
                style={{
                  width: `${Math.min(100, ((kpis?.total_hours ?? 0) / 160) * 100)}%`,
                  boxShadow: "2px 0 4px #2ae500",
                }}
              />
            </div>
          ) : (
            <div className="h-2" />
          )}
        </div>
      ))}
    </div>
  );
}
