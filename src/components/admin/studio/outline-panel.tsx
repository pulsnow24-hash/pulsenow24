"use client";

import { CloudUpload, Check, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  PUBLICATION,
  FAQ_ICON,
  workflowMeta,
  blockByField,
  type WorkflowState,
} from "@/lib/engine/publication";
import type { FormState } from "@/app/admin/formState";
import type { ArticleSocial } from "@/lib/articles";
import { completeness } from "./completeness";

export type SaveState = "idle" | "saving" | "saved" | "dirty";

function scrollToBlock(field: string) {
  document
    .getElementById(`block-${field}`)
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
}

export default function OutlinePanel({
  form,
  social,
  workflow,
  onWorkflowChange,
  scheduledFor,
  onScheduledChange,
  saveState,
  lastSavedAt,
  onSave,
  saving,
  editId,
  isLive,
}: {
  form: FormState;
  social: ArticleSocial | null;
  workflow: WorkflowState;
  onWorkflowChange: (w: WorkflowState) => void;
  scheduledFor: string;
  onScheduledChange: (v: string) => void;
  saveState: SaveState;
  lastSavedAt: Date | null;
  onSave: () => void;
  saving: boolean;
  editId: string | null;
  isLive: boolean;
}) {
  const comp = completeness(form, social);
  const meta = workflowMeta(workflow);

  const outline: { field: string; title: string; done: boolean }[] = [
    {
      field: PUBLICATION.teaserBlock.field,
      title: PUBLICATION.teaserBlock.title,
      done: !!form.sumar.trim(),
    },
    ...form.blockOrder.map((f) => ({
      field: f,
      title: blockByField(f)?.title ?? f,
      done: !!(form[f as keyof FormState] as string)?.trim?.(),
    })),
    {
      field: PUBLICATION.debateBlock.field,
      title: PUBLICATION.debateBlock.title,
      done: !!form.dezbatere.trim(),
    },
    {
      field: "qa",
      title: "Răspuns rapid",
      done: form.qa.some((p) => p.q.trim() && p.a.trim()),
    },
  ];

  const saveLabel =
    workflow === "published"
      ? isLive
        ? "Actualizează"
        : "Publică acum"
      : workflow === "scheduled"
        ? "Programează"
        : "Salvează";

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4">
      {/* Workflow */}
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Stare editorială
        </p>
        <Select
          value={workflow}
          onValueChange={(v) => onWorkflowChange(v as WorkflowState)}
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PUBLICATION.workflow.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                <w.icon className="size-4" />
                {w.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {workflow === "scheduled" && (
          <Input
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => onScheduledChange(e.target.value)}
            className="h-8 text-xs"
          />
        )}

        <Button className="w-full" size="sm" onClick={onSave} disabled={saving}>
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <meta.icon className="size-4" />
          )}
          {saveLabel}
        </Button>

        {isLive && editId && (
          <a
            href={`/articol/${editId}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-xs text-muted-foreground transition-colors hover:border-input hover:text-foreground"
          >
            <ExternalLink className="size-3.5" />
            Vezi pe site
          </a>
        )}

        {/* Autosave */}
        <p className="flex items-center gap-1.5 pt-1 font-mono text-[10px] text-muted-foreground">
          {saveState === "saving" && (
            <>
              <CloudUpload className="size-3 animate-pulse" />
              Se salvează…
            </>
          )}
          {saveState === "saved" && (
            <>
              <Check className="size-3 text-emerald-500" />
              Salvat{" "}
              {lastSavedAt
                ? lastSavedAt.toLocaleTimeString("ro-RO", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : ""}
            </>
          )}
          {saveState === "dirty" && (
            <>
              <span className="size-1.5 rounded-full bg-amber-400" />
              Modificări nesalvate
            </>
          )}
          {saveState === "idle" && (
            <span className="text-muted-foreground/60">
              Autosave activ pentru drafturi
            </span>
          )}
        </p>
      </div>

      {/* Progres */}
      <div className="space-y-2 border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Pregătire
          </p>
          <span
            className={cn(
              "font-mono text-xs font-medium tabular-nums",
              comp.percent >= 80
                ? "text-emerald-400"
                : comp.percent >= 50
                  ? "text-amber-400"
                  : "text-muted-foreground"
            )}
          >
            {comp.percent}%
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-secondary">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              comp.percent >= 80 ? "bg-emerald-500" : "bg-primary"
            )}
            style={{ width: `${comp.percent}%` }}
          />
        </div>
        <p className="font-mono text-[10px] text-muted-foreground">
          {comp.done}/{comp.total} elemente complete
        </p>
      </div>

      {/* Outline */}
      <div className="space-y-1 border-t border-border pt-4">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Structura articolului
        </p>
        {outline.map((item) => {
          const block = blockByField(item.field);
          const Icon = item.field === "qa" ? FAQ_ICON : (block?.icon ?? FAQ_ICON);
          return (
            <button
              key={item.field}
              onClick={() => scrollToBlock(item.field)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Icon className={cn("size-3.5", block?.accent)} />
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  item.done ? "bg-emerald-500" : "bg-border"
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
