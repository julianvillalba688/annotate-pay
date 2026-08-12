"use client";

import Link from "next/link";
import { ArrowRight, Database, FolderKanban } from "lucide-react";
import { KpiCards } from "@/components/kpis/KpiCards";
import { TaskLogList } from "@/components/tasks/TaskLogList";
import { useAnalytics } from "@/hooks/useAnalytics";
import { Button } from "@/components/ui/Button";
import { ErrorBlock } from "@/components/ui/Card";
import { useI18n } from "@/components/providers/PreferencesProvider";
import { getUserError } from "@/lib/errors";
import { EarningsSinceSummary } from "@/components/analytics/EarningsSinceSummary";
import { useEarningsStartDate } from "@/hooks/useEarningsStartDate";
import { useProfile } from "@/hooks/useProfile";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const router = useRouter();
  const profileQuery = useProfile();
  const { startDate, setStartDate } = useEarningsStartDate();
  const { data, isLoading, error } = useAnalytics({
    group_by: "month",
    date_from: startDate,
  });
  const { t } = useI18n();

  useEffect(() => {
    if (
      profileQuery.isSuccess &&
      profileQuery.data?.onboarding_status === "pending"
    ) {
      router.replace("/onboarding");
    }
  }, [profileQuery.data?.onboarding_status, profileQuery.isSuccess, router]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-outline-variant/30 pb-6">
        <div>
          <h1 className="font-sans text-headline-lg-mobile md:text-headline-lg text-primary-fixed">
             {t("dashboard.title")}
          </h1>
          <p className="font-sans text-body-md text-on-surface-variant mt-1">
             {t("dashboard.description")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/logs">
            <Button className="gap-2">
              <Database className="h-3.5 w-3.5" />
               {t("nav.logTasks")}
            </Button>
          </Link>
          <Link href="/projects">
            <Button variant="secondary" className="gap-2">
              <FolderKanban className="h-3.5 w-3.5" />
               {t("dashboard.manageProjects")}
            </Button>
          </Link>
        </div>
      </div>

      {error ? (
        <ErrorBlock message={getUserError(error, t, "errors.analyticsUnavailable")} />
      ) : null}

      <KpiCards
        kpis={data?.kpis}
        loading={isLoading || !!error}
        paymentStatusAvailable={data?.paymentStatusAvailable}
      />

      <EarningsSinceSummary
        kpis={data?.kpis}
        loading={isLoading || !!error}
        paymentStatusAvailable={data?.paymentStatusAvailable}
        date={startDate}
        onDateChange={setStartDate}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Link
          href="/analytics"
          className="bg-surface-card cyber-border p-5 hover:border-secondary-container/50 transition-colors group"
        >
          <div className="flex justify-between items-center">
            <span className="font-mono text-label-caps text-outline">
               {t("dashboard.analyticsLabel")}
            </span>
            <ArrowRight className="h-4 w-4 text-outline group-hover:text-secondary-container transition-colors" />
          </div>
          <p className="font-sans text-headline-md text-on-surface mt-2">
             {t("dashboard.analyticsTitle")}
          </p>
          <p className="font-mono text-data-sm text-on-surface-variant mt-1">
             {t("dashboard.analyticsDescription")}
          </p>
        </Link>
        <Link
          href="/logs"
          className="bg-surface-card cyber-border p-5 hover:border-secondary-container/50 transition-colors group"
        >
          <div className="flex justify-between items-center">
           <span className="font-mono text-label-caps text-outline">{t("dashboard.logsLabel")}</span>
            <ArrowRight className="h-4 w-4 text-outline group-hover:text-secondary-container transition-colors" />
          </div>
          <p className="font-sans text-headline-md text-on-surface mt-2">
             {t("dashboard.logsTitle")}
          </p>
          <p className="font-mono text-data-sm text-on-surface-variant mt-1">
             {t("dashboard.logsDescription")}
          </p>
        </Link>
        <Link
          href="/projects"
          className="bg-surface-card cyber-border p-5 hover:border-secondary-container/50 transition-colors group"
        >
          <div className="flex justify-between items-center">
            <span className="font-mono text-label-caps text-outline">
               {t("dashboard.projectsLabel")}
            </span>
            <ArrowRight className="h-4 w-4 text-outline group-hover:text-secondary-container transition-colors" />
          </div>
          <p className="font-sans text-headline-md text-on-surface mt-2">
             {t("dashboard.projectsTitle")}
          </p>
          <p className="font-mono text-data-sm text-on-surface-variant mt-1">
             {t("dashboard.projectsDescription")}
          </p>
        </Link>
      </div>

      <div>
        <h2 className="font-mono text-label-caps text-on-surface-variant uppercase tracking-widest mb-4">
           {t("dashboard.recentTransmissions")}
        </h2>
        <TaskLogList limit={8} />
      </div>
    </div>
  );
}
