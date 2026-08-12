"use client";

import { useState } from "react";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { ProjectList } from "@/components/projects/ProjectList";
import { GlobalRatePanel } from "@/components/projects/GlobalRatePanel";
import type { Project } from "@/types";
import { useI18n } from "@/components/providers/PreferencesProvider";

export default function ProjectsPage() {
  const [editing, setEditing] = useState<Project | null>(null);
  const { t } = useI18n();

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-outline-variant/30 pb-6">
        <div>
          <h1 className="font-sans text-headline-lg-mobile md:text-headline-lg text-on-surface mb-2">
             {t("projects.title")}
          </h1>
          <p className="font-sans text-body-md text-on-surface-variant">
             {t("projects.description")}
          </p>
        </div>
        <div id="global-rate-panel" className="scroll-mt-20">
          <GlobalRatePanel />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ProjectList
            onEdit={setEditing}
            editingId={editing?.id}
            onDeleted={(projectId) => {
              if (editing?.id === projectId) setEditing(null);
            }}
          />
        </div>
        <div className="lg:col-span-1">
          <ProjectForm editing={editing} onDone={() => setEditing(null)} />
        </div>
      </div>
    </div>
  );
}
