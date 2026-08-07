"use client";

import Link from "next/link";
import { ArrowRight, Database, FolderKanban } from "lucide-react";
import { KpiCards } from "@/components/kpis/KpiCards";
import { TaskLogList } from "@/components/tasks/TaskLogList";
import { useAnalytics } from "@/hooks/useAnalytics";
import { Button } from "@/components/ui/Button";

export default function DashboardPage() {
  const { data, isLoading } = useAnalytics({ group_by: "month" });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-outline-variant/30 pb-6">
        <div>
          <h1 className="font-sans text-headline-lg-mobile md:text-headline-lg text-primary-fixed">
            Dashboard
          </h1>
          <p className="font-sans text-body-md text-on-surface-variant mt-1">
            Overview of earnings, output, and recent transmissions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/logs">
            <Button className="gap-2">
              <Database className="h-3.5 w-3.5" />
              LOG_TASKS
            </Button>
          </Link>
          <Link href="/projects">
            <Button variant="secondary" className="gap-2">
              <FolderKanban className="h-3.5 w-3.5" />
              MANAGE_NODES
            </Button>
          </Link>
        </div>
      </div>

      <KpiCards kpis={data?.kpis} loading={isLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Link
          href="/analytics"
          className="bg-surface-card cyber-border p-5 hover:border-secondary-container/50 transition-colors group"
        >
          <div className="flex justify-between items-center">
            <span className="font-mono text-label-caps text-outline">
              ANALYTICS
            </span>
            <ArrowRight className="h-4 w-4 text-outline group-hover:text-secondary-container transition-colors" />
          </div>
          <p className="font-sans text-headline-md text-on-surface mt-2">
            Deep dive
          </p>
          <p className="font-mono text-data-sm text-on-surface-variant mt-1">
            Charts, filters, CSV export
          </p>
        </Link>
        <Link
          href="/logs"
          className="bg-surface-card cyber-border p-5 hover:border-secondary-container/50 transition-colors group"
        >
          <div className="flex justify-between items-center">
            <span className="font-mono text-label-caps text-outline">LOGS</span>
            <ArrowRight className="h-4 w-4 text-outline group-hover:text-secondary-container transition-colors" />
          </div>
          <p className="font-sans text-headline-md text-on-surface mt-2">
            Commit work
          </p>
          <p className="font-mono text-data-sm text-on-surface-variant mt-1">
            Live earnings preview
          </p>
        </Link>
        <Link
          href="/projects"
          className="bg-surface-card cyber-border p-5 hover:border-secondary-container/50 transition-colors group"
        >
          <div className="flex justify-between items-center">
            <span className="font-mono text-label-caps text-outline">
              PROJECTS
            </span>
            <ArrowRight className="h-4 w-4 text-outline group-hover:text-secondary-container transition-colors" />
          </div>
          <p className="font-sans text-headline-md text-on-surface mt-2">
            Configure AHT
          </p>
          <p className="font-mono text-data-sm text-on-surface-variant mt-1">
            Global rate + nodes
          </p>
        </Link>
      </div>

      <div>
        <h2 className="font-mono text-label-caps text-on-surface-variant uppercase tracking-widest mb-4">
          Recent Transmissions
        </h2>
        <TaskLogList limit={8} />
      </div>
    </div>
  );
}
