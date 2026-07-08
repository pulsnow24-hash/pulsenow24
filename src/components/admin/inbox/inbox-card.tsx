"use client";

import {
  Check,
  X,
  Sparkles,
  Eye,
  ExternalLink,
  MoreHorizontal,
  ShieldCheck,
  Copy,
  Share2,
  Layers,
  Loader2,
  Clock,
  CopyCheck,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { InboxDoc } from "./helpers";
import {
  priorityMeta,
  scoreColor,
  riskColor,
  faviconUrl,
  countryFlag,
  countryName,
  relativeTime,
} from "./helpers";
import { ScoreRing, ScoreStat } from "./score-ring";

export interface InboxActions {
  onApprove: (item: InboxDoc) => void;
  onReject: (item: InboxDoc) => void;
  onGenerate: (item: InboxDoc) => void;
  onPreview: (item: InboxDoc) => void;
  onOpen: (item: InboxDoc) => void;
  onFactCheck: (item: InboxDoc) => void;
  onSecondary: (item: InboxDoc, kind: "seo" | "social" | "tiktok" | "sources") => void;
}

export default function InboxCard({
  item,
  actions,
  busy,
  focused,
}: {
  item: InboxDoc;
  actions: InboxActions;
  busy: boolean;
  focused: boolean;
}) {
  const p = priorityMeta(item.priority);
  const favicon = faviconUrl(item.link);
  const rejected = item.status === "rejected";
  const approved = item.status === "approved";
  const drafted = item.status === "drafted";

  return (
    <article
      data-inbox-id={item.id}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors",
        focused ? "border-primary/60 ring-1 ring-primary/40" : "hover:border-input",
        rejected && "opacity-45"
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-0.5", p.bar)} />

      <div className="flex flex-col gap-3 p-4 pl-5">
        {/* Header */}
        <div className="flex items-center gap-2 text-xs">
          <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded bg-secondary">
            {favicon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={favicon}
                alt=""
                className="size-4"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : null}
          </span>
          <span className="font-medium text-foreground">{item.sursa}</span>
          <span className="text-border">·</span>
          <span
            className="text-muted-foreground"
            title={countryName(item.countryCode)}
          >
            {countryFlag(item.countryCode)} {item.countryCode}
          </span>
          <span className="text-border">·</span>
          <span className="text-muted-foreground">{item.categorie}</span>
          <span className="ml-auto flex items-center gap-1.5">
            {item.isDuplicate && (
              <span
                className="flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                title="Dublură detectată de AI"
              >
                <CopyCheck className="size-3" />
                dublură
              </span>
            )}
            {item.priority === "breaking" && (
              <span className="flex items-center gap-1 rounded-md bg-red-500/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-red-500">
                <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
                BREAKING
              </span>
            )}
            <span className="font-mono text-[11px] text-muted-foreground">
              {relativeTime(item.publicatLa || item.addedAt)}
            </span>
          </span>
        </div>

        {/* Body */}
        <div className="flex gap-4">
          <div className="flex flex-col items-center gap-1 pt-0.5">
            <ScoreRing value={item.importanceScore} colorClass={p.text} />
            <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
              importanță
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <button
              onClick={() => actions.onPreview(item)}
              className="block text-left"
            >
              <h3 className="line-clamp-2 text-[15px] font-medium leading-snug text-foreground transition-colors hover:text-primary">
                {item.titlu}
              </h3>
            </button>
            {item.descriere && (
              <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
                {item.descriere}
              </p>
            )}
            {item.reason && (
              <p className="mt-2 flex items-start gap-1.5 text-[12px] italic text-muted-foreground/80">
                <Sparkles className="mt-0.5 size-3 shrink-0 text-primary/70" />
                {item.reason}
              </p>
            )}
          </div>
        </div>

        {/* Metrics */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/60 pt-3">
          <ScoreStat
            label="Trust"
            value={item.trustScore}
            colorClass={scoreColor(item.trustScore)}
          />
          <ScoreStat
            label="Viral"
            value={item.viralScore}
            colorClass={scoreColor(item.viralScore)}
          />
          <ScoreStat
            label="SEO"
            value={item.seoScore}
            colorClass={scoreColor(item.seoScore)}
          />
          <ScoreStat
            label="Risc fake"
            value={item.fakeNewsRisk}
            colorClass={riskColor(item.fakeNewsRisk)}
          />
          <div className="flex items-center gap-1 font-mono text-[12px] text-muted-foreground">
            <Clock className="size-3.5" />
            {item.readingTime} min
          </div>
          {item.fakeNewsRisk >= 50 && (
            <span className="flex items-center gap-1 font-mono text-[11px] text-red-500">
              <AlertTriangle className="size-3.5" />
              verifică
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant={approved ? "default" : "outline"}
            className={cn(
              approved && "bg-emerald-600 hover:bg-emerald-600/90"
            )}
            onClick={() => actions.onApprove(item)}
          >
            <Check className="size-4" />
            {approved ? "Aprobat" : "Aprobă"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => actions.onReject(item)}
          >
            <X className="size-4" />
            {rejected ? "Respins" : "Respinge"}
          </Button>
          <Button
            size="sm"
            className="ml-auto"
            onClick={() => actions.onGenerate(item)}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {drafted ? "Regenerează" : "Generează articol"}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="outline" aria-label="Mai multe">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => actions.onPreview(item)}>
                <Eye className="size-4" />
                Preview
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.onOpen(item)}>
                <ExternalLink className="size-4" />
                Deschide sursa
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.onFactCheck(item)}>
                <ShieldCheck className="size-4" />
                Fact check
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.onSecondary(item, "sources")}>
                <Layers className="size-4" />
                Arată sursele
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => actions.onSecondary(item, "seo")}>
                <Copy className="size-4" />
                Generează SEO
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.onSecondary(item, "social")}>
                <Share2 className="size-4" />
                Generează social
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.onSecondary(item, "tiktok")}>
                <Layers className="size-4" />
                Carusel TikTok
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </article>
  );
}
