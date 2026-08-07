"use client";

import { FolderOpen, Pencil } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { formatAhtSeconds } from "@/lib/earnings";
import { shortId } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui/Card";
import type { Project } from "@/types";

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

  if (isLoading) return <LoadingBlock label="SCANNING_NODES..." />;
  if (error)
    return (
      <ErrorBlock
        message={error instanceof Error ? error.message : "Load failed"}
      />
    );

  if (!data?.length) {
    return (
      <EmptyState
        title="NO_ACTIVE_NODES"
        subtitle="Provision a project node to begin logging tasks."
        icon={<FolderOpen className="h-8 w-8" />}
      />
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-sans text-headline-md text-on-surface mb-4 flex items-center gap-2">
        <FolderOpen className="h-5 w-5 text-secondary-container" />
        Active Nodes
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
            <Badge tone={statusTone(p.status)}>{p.status}</Badge>
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
                title="Edit node"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-outline-variant/20 pt-4">
              <div>
                <p className="font-mono text-label-caps text-on-surface-variant">
                  AHT_ATT
                </p>
                <p className="font-mono text-data-lg text-on-surface">
                  {formatAhtSeconds(p.current_aht_attempter)}
                </p>
              </div>
              <div>
                <p className="font-mono text-label-caps text-on-surface-variant">
                  AHT_REV
                </p>
                <p className="font-mono text-data-lg text-on-surface">
                  {formatAhtSeconds(p.current_aht_reviewer)}
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
