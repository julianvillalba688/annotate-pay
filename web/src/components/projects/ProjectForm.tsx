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

interface ProjectFormProps {
  editing?: Project | null;
  onDone?: () => void;
}

const empty = {
  name: "",
  current_aht_attempter: 60,
  current_aht_reviewer: 30,
  status: "active" as ProjectStatus,
};

export function ProjectForm({ editing, onDone }: ProjectFormProps) {
  const create = useCreateProject();
  const update = useUpdateProject();

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
      setError("NODE_NAME is required");
      return;
    }
    if (form.current_aht_attempter < 0 || form.current_aht_reviewer < 0) {
      setError("AHT values must be >= 0");
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
        setOk("NODE_UPDATED");
        onDone?.();
      } else {
        await create.mutateAsync({
          name: form.name.trim(),
          current_aht_attempter: form.current_aht_attempter,
          current_aht_reviewer: form.current_aht_reviewer,
          status: form.status,
        });
        setOk("NODE_PROVISIONED");
        setForm(empty);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <div className="bg-surface-card cyber-border p-6 sticky top-24">
      <h3 className="font-sans text-headline-md text-on-surface mb-6 flex items-center gap-2 border-b border-outline-variant/30 pb-3">
        <PlusSquare className="h-5 w-5 text-primary-container" />
        {editing ? "Reconfigure Node" : "Configure Node"}
      </h3>

      <div className="mb-6 bg-error-container/20 border-l-2 border-error p-3 flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-error shrink-0 mt-0.5" />
        <div>
          <p className="font-mono text-data-sm text-error mb-1">
            SNAPSHOT PRESERVATION
          </p>
          <p className="font-sans text-sm text-error/80 leading-relaxed">
            Modifying AHT parameters will strictly apply to future logs.
            Historical earnings remain mathematically immutable.
          </p>
        </div>
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
        <TerminalInput
          label="NODE_NAME"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="e.g., Image_BBoxes_V2"
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <TerminalInput
            label="AHT_ATTEMPTER (s)"
            type="number"
            min={0}
            step="0.1"
            value={form.current_aht_attempter}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                current_aht_attempter: Math.max(0, Number(e.target.value) || 0),
              }))
            }
            className="text-right"
          />
          <TerminalInput
            label="AHT_REVIEWER (s)"
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
          label="STATUS"
          value={form.status}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              status: e.target.value as ProjectStatus,
            }))
          }
        >
          <option value="active" className="bg-anthracite">
            ACTIVE
          </option>
          <option value="paused" className="bg-anthracite">
            PAUSED
          </option>
          <option value="archived" className="bg-anthracite">
            ARCHIVED
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
            {editing ? "APPLY_PATCH" : "PROVISION_NODE"}
          </Button>
          {editing ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onDone?.()}
            >
              CANCEL
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
