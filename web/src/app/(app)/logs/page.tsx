"use client";

import { TaskLogForm } from "@/components/tasks/TaskLogForm";
import { TaskLogList } from "@/components/tasks/TaskLogList";

export default function LogsPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 border-b border-outline-variant/30 pb-6">
        <h1 className="font-sans text-headline-lg-mobile md:text-headline-lg text-on-background">
          System Logging
        </h1>
        <p className="text-on-surface-variant font-sans text-body-md max-w-2xl">
          Record task execution metrics to update global payout estimates in
          real-time. Official earnings freeze AHT + rate at commit.
        </p>
      </div>

      <TaskLogForm />

      <div className="flex flex-col gap-4 mt-4">
        <h3 className="font-mono text-label-caps text-on-surface-variant uppercase tracking-widest">
          Recent Transmissions
        </h3>
        <TaskLogList limit={40} />
      </div>
    </div>
  );
}
