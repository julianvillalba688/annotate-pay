"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, PlusSquare } from "lucide-react";
import { TerminalInput, TerminalSelect } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  useCreateProject,
  useUpdateProject,
} from "@/hooks/useProjects";
import type { Project, ProjectStatus } from "@/types";
import { useI18n } from "@/components/providers/PreferencesProvider";
import { getUserError } from "@/lib/errors";

interface ProjectFormProps {
  editing?: Project | null;
  onDone?: () => void;
}

const empty = {
  name: "",
  current_aht_attempter: 2,
  current_aht_reviewer: 1,
  status: "active" as ProjectStatus,
};

export function ProjectForm({ editing, onDone }: ProjectFormProps) {
  const create = useCreateProject();
  const update = useUpdateProject();
  const { t } = useI18n();

  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        current_aht_attempter: editing.current_aht_attempter,
        current_aht_reviewer: editing.current_aht_reviewer,
        status: editing.status,
      });
    } else {
      setForm(empty);
    }
    setError(null);
    setOk(null);
  }, [editing]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);

    if (!form.name.trim()) {
       setError(t("errors.projectNameRequired"));
      return;
    }
    if (form.current_aht_attempter < 0 || form.current_aht_reviewer < 0) {
       setError(t("errors.ahtNegative"));
      return;
    }

    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          name: form.name.trim(),
          current_aht_attempter: form.current_aht_attempter,
          current_aht_reviewer: form.current_aht_reviewer,
          status: form.status,
        });
         setOk(t("projects.updated"));
        onDone?.();
      } else {
        await create.mutateAsync({
          name: form.name.trim(),
          current_aht_attempter: form.current_aht_attempter,
          current_aht_reviewer: form.current_aht_reviewer,
          status: form.status,
        });
         setOk(t("projects.created"));
        setForm(empty);
      }
    } catch (err) {
       setError(getUserError(err, t, "errors.saveFailed"));
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <div className="bg-surface-card cyber-border p-6 sticky top-24">
      <h3 className="font-sans text-headline-md text-on-surface mb-6 flex items-center gap-2 border-b border-outline-variant/30 pb-3">
        <PlusSquare className="h-5 w-5 text-primary-container" />
         {editing ? t("projects.reconfigure") : t("projects.configure")}
      </h3>

      <div className="mb-6 bg-error-container/20 border-l-2 border-error p-3 flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-error shrink-0 mt-0.5" />
        <div>
          <p className="font-mono text-data-sm text-error mb-1">
             {t("projects.snapshotTitle")}
          </p>
          <p className="font-sans text-sm text-error/80 leading-relaxed">
             {t("projects.snapshotDescription")}
          </p>
        </div>
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
        <TerminalInput
           id="project-name"
           name="name"
           label={t("projects.projectName")}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
           placeholder={t("projects.projectPlaceholder")}
          required
        />

        <div className="grid grid-cols-2 gap-4">
           <TerminalInput
             id="aht-attempter"
             name="current_aht_attempter"
             label={t("projects.attempterAht")}
            type="number"
            min={0}
             step="0.1"
             value={form.current_aht_attempter}
             hint={t("projects.ahtHint")}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                current_aht_attempter: Math.max(0, Number(e.target.value) || 0),
              }))
            }
            className="text-right"
          />
           <TerminalInput
             id="aht-reviewer"
             name="current_aht_reviewer"
             label={t("projects.reviewerAht")}
            type="number"
            min={0}
             step="0.1"
             value={form.current_aht_reviewer}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                current_aht_reviewer: Math.max(0, Number(e.target.value) || 0),
              }))
            }
            className="text-right"
          />
        </div>

        <TerminalSelect
           id="project-status"
           name="status"
           label={t("projects.status")}
          value={form.status}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              status: e.target.value as ProjectStatus,
            }))
          }
        >
          <option value="active" className="bg-anthracite">
             {t("projects.activeStatus")}
          </option>
          <option value="paused" className="bg-anthracite">
             {t("projects.pausedStatus")}
          </option>
          <option value="archived" className="bg-anthracite">
             {t("projects.archivedStatus")}
          </option>
        </TerminalSelect>

        {error ? (
          <p className="font-mono text-[12px] text-error-bright">{error}</p>
        ) : null}
        {ok ? (
          <p className="font-mono text-[12px] text-tertiary">{ok}</p>
        ) : null}

        <div className="flex gap-2 pt-2">
          <Button type="submit" loading={pending} className="flex-1">
             {editing ? t("projects.applyPatch") : t("projects.create")}
          </Button>
          {editing ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onDone?.()}
            >
               {t("common.cancel")}
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
