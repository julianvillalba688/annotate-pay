"use client";

import { FolderOpen, Pencil } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { formatAhtMinutes } from "@/lib/formatters";
import { shortId } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui/Card";
import type { Project } from "@/types";
import { useI18n } from "@/components/providers/PreferencesProvider";
import { getUserError } from "@/lib/errors";

function statusTone(status: Project["status"]) {
  if (status === "active") return "success" as const;
  if (status === "paused") return "warning" as const;
  return "neutral" as const;
}

interface ProjectListProps {
  onEdit: (project: Project) => void;
  editingId?: string | null;
}

export function ProjectList({ onEdit, editingId }: ProjectListProps) {
  const { data, isLoading, error } = useProjects();
  const { t, localeCode } = useI18n();

  if (isLoading) return <LoadingBlock label={t("projects.scanning")} />;
  if (error)
    return (
      <ErrorBlock
        message={getUserError(error, t, "errors.loadFailed")}
      />
    );

  if (!data?.length) {
    return (
      <EmptyState
        title={t("projects.noProjects")}
        subtitle={t("projects.noProjectsDescription")}
        icon={<FolderOpen className="h-8 w-8" />}
      />
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-sans text-headline-md text-on-surface mb-4 flex items-center gap-2">
        <FolderOpen className="h-5 w-5 text-secondary-container" />
         {t("projects.active")}
      </h3>
      {data.map((p) => (
        <div
          key={p.id}
          className={`bg-surface-card cyber-border flex flex-col transition-all duration-200 ${
            editingId === p.id ? "border-secondary-container shadow-glow-cyan-sm" : ""
          }`}
        >
          <div className="zebra-header p-2 border-b border-electric/20 flex justify-between items-center">
            <span className="font-mono text-data-sm text-primary">
              ID: PRJ-{shortId(p.id)}
            </span>
             <Badge tone={statusTone(p.status)}>
               {t(`projects.${p.status}Status`)}
             </Badge>
          </div>
          <div className="p-5 flex-1">
            <div className="flex justify-between items-start gap-3 mb-4">
              <h4 className="font-sans text-headline-md text-on-surface">
                {p.name}
              </h4>
              <button
                type="button"
                onClick={() => onEdit(p)}
                className="text-on-surface-variant hover:text-secondary-container transition-colors p-1"
                 title={t("projects.edit")}
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-outline-variant/20 pt-4">
              <div>
                <p className="font-mono text-label-caps text-on-surface-variant">
                   {t("projects.attempterAhtShort")}
                </p>
                <p className="font-mono text-data-lg text-on-surface">
                   {formatAhtMinutes(p.current_aht_attempter, localeCode)}
                </p>
              </div>
              <div>
                <p className="font-mono text-label-caps text-on-surface-variant">
                   {t("projects.reviewerAhtShort")}
                </p>
                <p className="font-mono text-data-lg text-on-surface">
                   {formatAhtMinutes(p.current_aht_reviewer, localeCode)}
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
