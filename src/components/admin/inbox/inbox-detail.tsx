"use client";

import { useEffect, useState } from "react";
import {
  ExternalLink,
  Sparkles,
  ShieldCheck,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { FactCheckResult } from "@/lib/ai-types";
import type { InboxDoc } from "./helpers";
import {
  priorityMeta,
  scoreColor,
  riskColor,
  countryFlag,
  countryName,
  domainOf,
  relativeTime,
} from "./helpers";
import { ScoreRing } from "./score-ring";

const VERDICT: Record<
  FactCheckResult["verdict"],
  { label: string; className: string }
> = {
  credibil: { label: "Credibil", className: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  partial: { label: "Parțial", className: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  indoielnic: { label: "Îndoielnic", className: "text-red-500 border-red-500/30 bg-red-500/10" },
  neverificabil: { label: "Neverificabil", className: "text-zinc-400 border-zinc-500/30 bg-zinc-500/10" },
};

export default function InboxDetail({
  item,
  open,
  onOpenChange,
  onGenerate,
  runFactCheck,
  autoFactCheck,
}: {
  item: InboxDoc | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (item: InboxDoc) => void;
  runFactCheck: (item: InboxDoc) => Promise<FactCheckResult>;
  autoFactCheck: boolean;
}) {
  const [fc, setFc] = useState<FactCheckResult | null>(null);
  const [fcBusy, setFcBusy] = useState(false);
  const [fcError, setFcError] = useState("");

  async function doFactCheck(target: InboxDoc) {
    setFcBusy(true);
    setFcError("");
    setFc(null);
    try {
      setFc(await runFactCheck(target));
    } catch (e) {
      setFcError(e instanceof Error ? e.message : String(e));
    } finally {
      setFcBusy(false);
    }
  }

  useEffect(() => {
    // Resetează starea când se schimbă articolul; rulează fact check automat dacă e cerut
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFc(null);
    setFcError("");
    setFcBusy(false);
    if (open && item && autoFactCheck) {
      doFactCheck(item);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, open, autoFactCheck]);

  if (!item) return null;
  const p = priorityMeta(item.priority);

  const metrics = [
    { label: "Trust", value: item.trustScore, color: scoreColor(item.trustScore) },
    { label: "Viral", value: item.viralScore, color: scoreColor(item.viralScore) },
    { label: "SEO", value: item.seoScore, color: scoreColor(item.seoScore) },
    { label: "Risc fake", value: item.fakeNewsRisk, color: riskColor(item.fakeNewsRisk) },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="gap-3 border-b border-border p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn("rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium", p.bg, p.text)}>
              {p.label}
            </span>
            <span className="font-medium text-foreground">{item.sursa}</span>
            <span className="text-border">·</span>
            <span title={countryName(item.countryCode)}>
              {countryFlag(item.countryCode)} {item.countryCode}
            </span>
            <span className="text-border">·</span>
            <span>{item.categorie}</span>
            <span className="ml-auto font-mono">
              {relativeTime(item.publicatLa || item.addedAt)}
            </span>
          </div>
          <SheetTitle className="text-lg leading-snug">{item.titlu}</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 p-5">
          <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-col items-center gap-1">
              <ScoreRing value={item.importanceScore} size={56} colorClass={p.text} />
              <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                importanță
              </span>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-3">
              {metrics.map((m) => (
                <div key={m.label}>
                  <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                    {m.label}
                  </div>
                  <div className={cn("font-mono text-base font-medium tabular-nums", m.color)}>
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {item.descriere && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {item.descriere}
            </p>
          )}

          {item.reason && (
            <div className="flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary/70" />
              <span className="italic">{item.reason}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => onGenerate(item)}>
              <Sparkles className="size-4" />
              Generează articol
            </Button>
            {item.link && (
              <Button variant="outline" asChild>
                <a href={item.link} target="_blank" rel="noreferrer nofollow">
                  <ExternalLink className="size-4" />
                  {domainOf(item.link) || "Sursă"}
                </a>
              </Button>
            )}
          </div>

          <Separator />

          {/* Fact check */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="size-4 text-primary" />
                Verificare AI
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => doFactCheck(item)}
                disabled={fcBusy}
              >
                {fcBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ShieldCheck className="size-4" />
                )}
                {fc ? "Din nou" : "Rulează"}
              </Button>
            </div>

            {fcError && <p className="text-sm text-destructive">{fcError}</p>}

            {fcBusy && !fc && (
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="h-2 w-2/3 animate-pulse rounded bg-secondary" />
                <div className="h-2 w-full animate-pulse rounded bg-secondary" />
                <div className="h-2 w-1/2 animate-pulse rounded bg-secondary" />
              </div>
            )}

            {fc && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs font-medium",
                      VERDICT[fc.verdict].className
                    )}
                  >
                    {VERDICT[fc.verdict].label}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {fc.confidence}% încredere
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-foreground/90">
                  {fc.summary}
                </p>
                {fc.redFlags.length > 0 && (
                  <ul className="space-y-1">
                    {fc.redFlags.map((flag, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs text-amber-400"
                      >
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                        {flag}
                      </li>
                    ))}
                  </ul>
                )}
                {fc.claims.length > 0 && (
                  <div className="space-y-2 border-t border-border pt-3">
                    {fc.claims.map((c, i) => (
                      <div key={i} className="text-xs">
                        <p className="text-foreground">{c.claim}</p>
                        <p className="mt-0.5 text-muted-foreground">
                          {c.assessment}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
