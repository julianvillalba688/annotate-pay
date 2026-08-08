"use client";

import { TaskLogForm } from "@/components/tasks/TaskLogForm";
import { TaskLogList } from "@/components/tasks/TaskLogList";
import { useI18n } from "@/components/providers/PreferencesProvider";

export default function LogsPage() {
  const { t } = useI18n();
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 border-b border-outline-variant/30 pb-6">
        <h1 className="font-sans text-headline-lg-mobile md:text-headline-lg text-on-background">
           {t("logs.title")}
        </h1>
        <p className="text-on-surface-variant font-sans text-body-md max-w-2xl">
           {t("logs.description")}
        </p>
      </div>

      <TaskLogForm />

      <div className="flex flex-col gap-4 mt-4">
        <h3 className="font-mono text-label-caps text-on-surface-variant uppercase tracking-widest">
           {t("logs.recent")}
        </h3>
        <TaskLogList limit={40} />
      </div>
    </div>
  );
}
