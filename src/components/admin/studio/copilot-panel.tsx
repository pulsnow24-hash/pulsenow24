"use client";

import { useState } from "react";
import {
  Sparkles,
  Type,
  Wand2,
  Minimize2,
  Maximize2,
  Briefcase,
  Scale,
  Search,
  ListOrdered,
  ShieldCheck,
  FileText,
  ThumbsUp,
  Camera,
  AtSign,
  Mail,
  Bell,
  GalleryHorizontalEnd,
  Image as ImageIcon,
  Copy,
  CornerDownLeft,
  Loader2,
  HelpCircle,
  KeyRound,
  AlignLeft,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CopilotResult } from "@/lib/ai-types";

/** Ce poate aplica panoul asupra articolului — furnizat de Studio. */
export interface CopilotApply {
  setTitle: (v: string) => void;
  setFieldWithUndo: (field: string, v: string) => void;
  setMeta: (v: string) => void;
  setKeywords: (v: string) => void;
  setQa: (qa: { q: string; a: string }[]) => void;
  setSocial: (k: "facebook" | "instagram" | "x" | "linkedin", v: string) => void;
  setImagePrompt: (v: string) => void;
}

interface ActionDef {
  id: string;
  label: string;
  icon: LucideIcon;
  needsTarget?: boolean;
  /** Cum se aplică rezultatul (lipsă = doar copiere) */
  apply?: (result: CopilotResult, api: CopilotApply, targetField?: string) => void;
  applyLabel?: string;
}

interface GroupDef {
  title: string;
  actions: ActionDef[];
}

const applyText =
  (fn: (api: CopilotApply, text: string, targetField?: string) => void) =>
  (result: CopilotResult, api: CopilotApply, targetField?: string) => {
    if (result.kind === "text") fn(api, result.text, targetField);
  };

const GROUPS: GroupDef[] = [
  {
    title: "Titlu",
    actions: [
      { id: "improve-headline", label: "Îmbunătățește titlul", icon: Type },
    ],
  },
  {
    title: "Blocul activ",
    actions: [
      { id: "rewrite", label: "Rescrie", icon: Wand2, needsTarget: true, applyLabel: "Aplică pe bloc", apply: applyText((api, t, f) => f && api.setFieldWithUndo(f, t)) },
      { id: "shorten", label: "Scurtează", icon: Minimize2, needsTarget: true, applyLabel: "Aplică pe bloc", apply: applyText((api, t, f) => f && api.setFieldWithUndo(f, t)) },
      { id: "expand", label: "Extinde", icon: Maximize2, needsTarget: true, applyLabel: "Aplică pe bloc", apply: applyText((api, t, f) => f && api.setFieldWithUndo(f, t)) },
      { id: "tone-professional", label: "Ton profesional", icon: Briefcase, needsTarget: true, applyLabel: "Aplică pe bloc", apply: applyText((api, t, f) => f && api.setFieldWithUndo(f, t)) },
      { id: "tone-neutral", label: "Ton neutru", icon: Scale, needsTarget: true, applyLabel: "Aplică pe bloc", apply: applyText((api, t, f) => f && api.setFieldWithUndo(f, t)) },
      { id: "seo-optimize", label: "Optimizare SEO", icon: Search, needsTarget: true, applyLabel: "Aplică pe bloc", apply: applyText((api, t, f) => f && api.setFieldWithUndo(f, t)) },
    ],
  },
  {
    title: "SEO",
    actions: [
      { id: "meta-description", label: "Meta description", icon: AlignLeft, applyLabel: "Setează meta", apply: applyText((api, t) => api.setMeta(t)) },
      {
        id: "keywords",
        label: "Keywords",
        icon: KeyRound,
        applyLabel: "Setează keywords",
        apply: (r, api) => {
          if (r.kind === "list") api.setKeywords(r.items.join(", "));
        },
      },
      {
        id: "faq",
        label: "FAQ (Răspuns rapid)",
        icon: HelpCircle,
        applyLabel: "Înlocuiește FAQ",
        apply: (r, api) => {
          if (r.kind === "qa") api.setQa(r.qa);
        },
      },
    ],
  },
  {
    title: "Conținut",
    actions: [
      { id: "timeline", label: "Cronologie", icon: ListOrdered },
      { id: "fact-check", label: "Verificare editorială", icon: ShieldCheck },
      { id: "source-summary", label: "Rezumatul sursei", icon: FileText },
    ],
  },
  {
    title: "Distribuție",
    actions: [
      { id: "facebook", label: "Postare Facebook", icon: ThumbsUp, applyLabel: "Salvează în articol", apply: applyText((api, t) => api.setSocial("facebook", t)) },
      { id: "instagram", label: "Caption Instagram", icon: Camera, applyLabel: "Salvează în articol", apply: applyText((api, t) => api.setSocial("instagram", t)) },
      {
        id: "x-thread",
        label: "Thread X",
        icon: AtSign,
        applyLabel: "Salvează în articol",
        apply: (r, api) => {
          if (r.kind === "list") api.setSocial("x", r.items.join("\n\n"));
        },
      },
      { id: "linkedin", label: "Postare LinkedIn", icon: Briefcase, applyLabel: "Salvează în articol", apply: applyText((api, t) => api.setSocial("linkedin", t)) },
      { id: "newsletter", label: "Newsletter", icon: Mail },
      { id: "push-notification", label: "Notificare push", icon: Bell },
      { id: "tiktok-carousel", label: "Carusel TikTok", icon: GalleryHorizontalEnd },
      { id: "image-prompt", label: "Prompt imagine", icon: ImageIcon, applyLabel: "Setează sugestia", apply: applyText((api, t) => api.setImagePrompt(t)) },
    ],
  },
];

function resultToClipboard(result: CopilotResult): string {
  switch (result.kind) {
    case "text":
      return result.text;
    case "options":
      return result.options.join("\n");
    case "list":
      return result.items.join("\n\n");
    case "qa":
      return result.qa.map((p) => `Î: ${p.q}\nR: ${p.a}`).join("\n\n");
  }
}

export default function CopilotPanel({
  focusedLabel,
  focusedField,
  run,
  api,
  busyAction,
}: {
  focusedLabel: string | null;
  focusedField: string | null;
  run: (actionId: string) => Promise<CopilotResult>;
  api: CopilotApply;
  busyAction: string | null;
}) {
  const [result, setResult] = useState<{
    action: ActionDef;
    data: CopilotResult;
    targetField?: string;
  } | null>(null);

  async function execute(action: ActionDef) {
    if (action.needsTarget && !focusedField) {
      toast.info("Dă click într-un bloc mai întâi — acțiunea se aplică pe blocul activ.");
      return;
    }
    try {
      const data = await run(action.id);
      setResult({ action, data, targetField: focusedField ?? undefined });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  function applyResult() {
    if (!result?.action.apply) return;
    result.action.apply(result.data, api, result.targetField);
    toast.success("Aplicat.");
  }

  function copyResult() {
    if (!result) return;
    navigator.clipboard.writeText(resultToClipboard(result.data));
    toast.success("Copiat în clipboard.");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {GROUPS.map((group) => (
          <div key={group.title}>
            <p className="mb-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {group.title}
              {group.title === "Blocul activ" && (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 font-sans text-[10px] normal-case tracking-normal",
                    focusedLabel
                      ? "bg-primary/10 text-primary"
                      : "bg-secondary text-muted-foreground/70"
                  )}
                >
                  {focusedLabel ?? "niciun bloc selectat"}
                </span>
              )}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {group.actions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => execute(action)}
                  disabled={busyAction !== null}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-left text-[12px] text-foreground/90 transition-colors hover:border-input hover:bg-accent disabled:opacity-50",
                    busyAction === action.id && "border-primary/50"
                  )}
                >
                  {busyAction === action.id ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
                  ) : (
                    <action.icon className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Rezultat */}
      {result && (
        <div className="max-h-[45%] shrink-0 overflow-y-auto border-t border-border bg-card/60 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-primary">
              <Sparkles className="size-3" />
              {result.action.label}
            </p>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={copyResult}>
                <Copy className="size-3.5" />
                Copiază
              </Button>
              {result.action.apply && (
                <Button size="sm" className="h-7 px-2" onClick={applyResult}>
                  <CornerDownLeft className="size-3.5" />
                  {result.action.applyLabel ?? "Aplică"}
                </Button>
              )}
            </div>
          </div>

          {result.data.kind === "text" && (
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">
              {result.data.text}
            </p>
          )}
          {result.data.kind === "options" && (
            <ul className="space-y-1.5">
              {result.data.options.map((opt, i) => (
                <li key={i}>
                  <button
                    onClick={() => {
                      api.setTitle(opt);
                      toast.success("Titlu aplicat.");
                    }}
                    className="w-full rounded-lg border border-border px-3 py-2 text-left text-[13px] leading-snug transition-colors hover:border-primary/50 hover:bg-accent"
                  >
                    {opt}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {result.data.kind === "list" && (
            <ol className="list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-foreground/90">
              {result.data.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ol>
          )}
          {result.data.kind === "qa" && (
            <div className="space-y-2">
              {result.data.qa.map((pair, i) => (
                <div key={i} className="text-[13px]">
                  <p className="font-medium">{pair.q}</p>
                  <p className="text-muted-foreground">{pair.a}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
