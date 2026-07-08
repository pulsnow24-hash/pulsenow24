"use client";

import { Check, X, Sparkles, MoreHorizontal, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { InboxDoc } from "./helpers";
import type { InboxActions } from "./inbox-card";
import {
  priorityMeta,
  scoreColor,
  riskColor,
  faviconUrl,
  countryFlag,
  relativeTime,
} from "./helpers";

const HEADERS = [
  { key: "src", label: "Sursă", className: "text-left" },
  { key: "title", label: "Titlu", className: "text-left" },
  { key: "cat", label: "Categorie", className: "text-left hidden lg:table-cell" },
  { key: "imp", label: "Imp", className: "text-right" },
  { key: "trust", label: "Trust", className: "text-right hidden md:table-cell" },
  { key: "viral", label: "Viral", className: "text-right hidden md:table-cell" },
  { key: "seo", label: "SEO", className: "text-right hidden md:table-cell" },
  { key: "risk", label: "Risc", className: "text-right hidden md:table-cell" },
  { key: "time", label: "Ora", className: "text-right hidden sm:table-cell" },
  { key: "act", label: "", className: "text-right" },
];

export default function InboxTable({
  items,
  actions,
  busyId,
  focusedId,
}: {
  items: InboxDoc[];
  actions: InboxActions;
  busyId: string | null;
  focusedId: string | null;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {HEADERS.map((h) => (
              <th
                key={h.key}
                className={cn(
                  "bg-card px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
                  h.className
                )}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const p = priorityMeta(item.priority);
            const favicon = faviconUrl(item.link);
            return (
              <tr
                key={item.id}
                data-inbox-id={item.id}
                className={cn(
                  "border-b border-border/60 transition-colors last:border-0 hover:bg-accent/40",
                  item.status === "rejected" && "opacity-45",
                  focusedId === item.id && "bg-primary/5"
                )}
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={cn("size-1.5 shrink-0 rounded-full", p.bar)} />
                    {favicon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={favicon}
                        alt=""
                        className="size-4 shrink-0"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display =
                            "none";
                        }}
                      />
                    ) : null}
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {countryFlag(item.countryCode)}
                    </span>
                  </div>
                </td>
                <td className="max-w-md px-3 py-2">
                  <button
                    onClick={() => actions.onPreview(item)}
                    className="block truncate text-left text-[13px] text-foreground hover:text-primary"
                    title={item.titlu}
                  >
                    {item.titlu}
                  </button>
                </td>
                <td className="hidden px-3 py-2 lg:table-cell">
                  <span className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                    {item.categorie}
                  </span>
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right font-mono text-[13px] font-medium tabular-nums",
                    p.text
                  )}
                >
                  {item.importanceScore}
                </td>
                <td
                  className={cn(
                    "hidden px-3 py-2 text-right font-mono text-xs tabular-nums md:table-cell",
                    scoreColor(item.trustScore)
                  )}
                >
                  {item.trustScore}
                </td>
                <td
                  className={cn(
                    "hidden px-3 py-2 text-right font-mono text-xs tabular-nums md:table-cell",
                    scoreColor(item.viralScore)
                  )}
                >
                  {item.viralScore}
                </td>
                <td
                  className={cn(
                    "hidden px-3 py-2 text-right font-mono text-xs tabular-nums md:table-cell",
                    scoreColor(item.seoScore)
                  )}
                >
                  {item.seoScore}
                </td>
                <td
                  className={cn(
                    "hidden px-3 py-2 text-right font-mono text-xs tabular-nums md:table-cell",
                    riskColor(item.fakeNewsRisk)
                  )}
                >
                  {item.fakeNewsRisk}
                </td>
                <td className="hidden px-3 py-2 text-right font-mono text-[11px] text-muted-foreground sm:table-cell">
                  {relativeTime(item.publicatLa || item.addedAt)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label="Aprobă"
                      onClick={() => actions.onApprove(item)}
                    >
                      <Check
                        className={cn(
                          "size-4",
                          item.status === "approved" && "text-emerald-500"
                        )}
                      />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label="Respinge"
                      onClick={() => actions.onReject(item)}
                    >
                      <X className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label="Generează articol"
                      onClick={() => actions.onGenerate(item)}
                      disabled={busyId === item.id}
                    >
                      {busyId === item.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Sparkles className="size-4" />
                      )}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          aria-label="Mai multe"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => actions.onPreview(item)}>
                          Preview
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => actions.onOpen(item)}>
                          Deschide sursa
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => actions.onFactCheck(item)}
                        >
                          Fact check
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
