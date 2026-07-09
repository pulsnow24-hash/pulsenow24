"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, AlertTriangle, X, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { collection, getDocs, type Firestore } from "firebase/firestore/lite";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Article } from "@/lib/articles";
import type { FormState } from "@/app/admin/formState";
import {
  seoChecks,
  seoScore,
  readability,
  discoverChecks,
  type SeoCheck,
} from "./seo-utils";

const LEVEL_ICON = {
  pass: { icon: Check, className: "text-emerald-500" },
  warn: { icon: AlertTriangle, className: "text-amber-400" },
  fail: { icon: X, className: "text-red-500" },
};

function CheckRow({ check }: { check: SeoCheck }) {
  const meta = LEVEL_ICON[check.level];
  return (
    <div className="flex items-start gap-2 py-1.5">
      <meta.icon className={cn("mt-0.5 size-3.5 shrink-0", meta.className)} />
      <div className="min-w-0">
        <p className="text-[12.5px] font-medium leading-tight">{check.label}</p>
        <p className="text-[11.5px] leading-snug text-muted-foreground">
          {check.detail}
        </p>
      </div>
    </div>
  );
}

export default function SeoPanel({
  form,
  set,
  db,
  editId,
}: {
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  db: Firestore;
  editId: string | null;
}) {
  const checks = seoChecks(form);
  const score = seoScore(checks);
  const read = readability(form);
  const discover = discoverChecks(form);

  // Sugestii de linkuri interne: articole din aceeași categorie sau cu taguri comune
  const [suggestions, setSuggestions] = useState<Article[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(collection(db, "articles"));
        if (cancelled) return;
        const tags = new Set(
          form.taguri.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)
        );
        const list = snap.docs
          .map((d) => ({ ...d.data(), id: d.id }) as Article)
          .filter((a) => a.id !== editId && a.status !== "draft")
          .map((a) => ({
            a,
            score:
              (a.categorie === form.categorie ? 2 : 0) +
              (a.taguri ?? []).filter((t) => tags.has(t.toLowerCase())).length,
          }))
          .filter((x) => x.score > 0)
          .sort((x, y) => y.score - x.score)
          .slice(0, 4)
          .map((x) => x.a);
        setSuggestions(list);
      } catch {
        /* fără sugestii */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, editId, form.categorie, form.taguri]);

  const scoreColor =
    score >= 75 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-500";

  const schemaItems = [
    { label: "headline", ok: !!form.titlu.trim() },
    { label: "description", ok: !!(form.metaDescription.trim() || form.sumar.trim()) },
    { label: "image", ok: !!form.imagineUrl.trim() },
    { label: "datePublished", ok: true },
    { label: "articleSection", ok: !!form.categorie },
    { label: "keywords", ok: !!form.taguri.trim() },
  ];

  return (
    <div className="h-full space-y-5 overflow-y-auto p-4">
      {/* Scor */}
      <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
        <div className="text-center">
          <p className={cn("font-mono text-3xl font-medium tabular-nums", scoreColor)}>
            {score}
          </p>
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Scor SEO
          </p>
        </div>
        <div className="h-10 w-px bg-border" />
        <div className="flex-1">
          <p className="text-sm font-medium">{read.label}</p>
          <p className="text-[11.5px] text-muted-foreground">
            Lizibilitate {read.score > 0 ? `${read.score}/100` : ""} · {read.detail}
          </p>
        </div>
      </div>

      {/* Meta */}
      <div className="space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Metadate
        </p>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Title SEO · {form.seoTitle.length}/60
          </Label>
          <Input
            value={form.seoTitle}
            onChange={(e) => set("seoTitle", e.target.value)}
            className="h-8 text-[13px]"
            placeholder="Gol = titlul articolului"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Meta description · {form.metaDescription.length}/158
          </Label>
          <Textarea
            value={form.metaDescription}
            onChange={(e) => set("metaDescription", e.target.value)}
            rows={3}
            className="text-[13px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Keywords</Label>
          <Input
            value={form.keywords}
            onChange={(e) => set("keywords", e.target.value)}
            className="h-8 text-[13px]"
            placeholder="separate prin virgulă"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Canonical URL</Label>
          <Input
            value={form.canonical}
            onChange={(e) => set("canonical", e.target.value)}
            className="h-8 font-mono text-xs"
            placeholder="https://…"
          />
        </div>
      </div>

      {/* Verificări */}
      <div>
        <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Verificări în timp real
        </p>
        <div className="divide-y divide-border/60">
          {checks.map((c) => (
            <CheckRow key={c.label} check={c} />
          ))}
        </div>
      </div>

      {/* Discover */}
      <div>
        <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Google Discover
        </p>
        <div className="divide-y divide-border/60">
          {discover.map((c) => (
            <CheckRow key={c.label} check={c} />
          ))}
        </div>
      </div>

      {/* Linkuri interne */}
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Linkuri interne sugerate
        </p>
        {suggestions.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">
            Niciun articol înrudit găsit (după categorie/taguri).
          </p>
        ) : (
          <ul className="space-y-1.5">
            {suggestions.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-[12px]">{a.titlu}</span>
                <button
                  aria-label="Copiază linkul"
                  onClick={() => {
                    navigator.clipboard.writeText(`/articol/${a.id}`);
                    toast.success("Link copiat.");
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Copy className="size-3.5" />
                </button>
                <Link
                  href={`/articol/${a.id}`}
                  target="_blank"
                  aria-label="Deschide articolul"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="size-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Linkuri externe */}
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Linkuri externe
        </p>
        {form.sursaUrl.trim() ? (
          <p className="truncate rounded-lg border border-border px-2.5 py-2 font-mono text-[11px] text-muted-foreground">
            {form.sursaUrl}
          </p>
        ) : (
          <p className="text-[12px] text-muted-foreground">
            {"Adaugă linkul sursei în secțiunea „Sursă” — e afișat în articol și contează la credibilitate."}
          </p>
        )}
      </div>

      {/* Schema.org */}
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Schema.org · NewsArticle
        </p>
        <div className="grid grid-cols-2 gap-1">
          {schemaItems.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-1.5 font-mono text-[11px]"
            >
              {item.ok ? (
                <Check className="size-3 text-emerald-500" />
              ) : (
                <X className="size-3 text-red-500" />
              )}
              <span className={item.ok ? "text-foreground/80" : "text-muted-foreground"}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          JSON-LD-ul NewsArticle e generat automat pe pagina publică din aceste
          câmpuri.
        </p>
      </div>
    </div>
  );
}
