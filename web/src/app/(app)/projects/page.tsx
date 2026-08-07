"use client";

import { useState } from "react";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { ProjectList } from "@/components/projects/ProjectList";
import { GlobalRatePanel } from "@/components/projects/GlobalRatePanel";
import type { Project } from "@/types";

export default function ProjectsPage() {
  const [editing, setEditing] = useState<Project | null>(null);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-outline-variant/30 pb-6">
        <div>
          <h1 className="font-sans text-headline-lg-mobile md:text-headline-lg text-on-surface mb-2">
            Project Terminal
          </h1>
          <p className="font-sans text-body-md text-on-surface-variant">
            Manage annotation workloads and global rate configurations.
          </p>
        </div>
        <GlobalRatePanel />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ProjectList
            onEdit={setEditing}
            editingId={editing?.id}
          />
        </div>
        <div className="lg:col-span-1">
          <ProjectForm
            editing={editing}
            onDone={() => setEditing(null)}
          />
        </div>
      </div>
    </div>
  );
}
