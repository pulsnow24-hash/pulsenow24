"use client";

import {
  Pencil,
  Trash2,
  MoreHorizontal,
  ShieldCheck,
  Ban,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  statusMeta,
  trustScore,
  type RssSource,
} from "@/lib/engine/sources";
import {
  faviconUrl,
  countryFlag,
  relativeTime,
} from "@/components/admin/inbox/helpers";
import { HealthBar } from "./charts";

const HEADERS = [
  { label: "Sursă", cls: "text-left" },
  { label: "Categorie", cls: "text-left hidden lg:table-cell" },
  { label: "Azi", cls: "text-right" },
  { label: "Status", cls: "text-left" },
  { label: "Răspuns", cls: "text-right hidden md:table-cell" },
  { label: "Sănătate", cls: "text-left hidden md:table-cell" },
  { label: "Trust", cls: "text-right hidden sm:table-cell" },
  { label: "Sync", cls: "text-right hidden lg:table-cell" },
  { label: "", cls: "text-right" },
];

export default function SourcesTable({
  sources,
  onEdit,
  onDelete,
  onPatch,
}: {
  sources: RssSource[];
  onEdit: (s: RssSource) => void;
  onDelete: (s: RssSource) => void;
  onPatch: (id: string, patch: Partial<RssSource>) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {HEADERS.map((h, i) => (
              <th
                key={i}
                className={cn(
                  "bg-card px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
                  h.cls
                )}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => {
            const meta = statusMeta(s.status);
            const favicon = faviconUrl(s.url);
            return (
              <tr
                key={s.id}
                className={cn(
                  "border-b border-border/60 transition-colors last:border-0 hover:bg-accent/40",
                  (!s.enabled || s.blocked) && "opacity-50"
                )}
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded bg-secondary">
                      {favicon && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={favicon}
                          alt=""
                          className="size-4"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-medium">{s.name}</span>
                        {s.trusted && (
                          <ShieldCheck className="size-3 shrink-0 text-emerald-500" />
                        )}
                        {s.blocked && <Ban className="size-3 shrink-0 text-red-500" />}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                        {countryFlag(s.countryCode)} {s.countryCode} · P{s.priority}
                      </span>
                    </span>
                  </div>
                </td>
                <td className="hidden px-3 py-2 lg:table-cell">
                  <span className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                    {s.category}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono text-[13px] tabular-nums">
                  {s.articlesToday ?? 0}
                </td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-1.5">
                    <span className={cn("size-1.5 rounded-full", meta.dot)} />
                    <span className={cn("text-[12px]", meta.text)}>{meta.label}</span>
                  </span>
                </td>
                <td className="hidden px-3 py-2 text-right font-mono text-[12px] tabular-nums text-muted-foreground md:table-cell">
                  {s.responseTime ? `${s.responseTime}ms` : "—"}
                </td>
                <td className="hidden px-3 py-2 md:table-cell">
                  <HealthBar value={s.healthScore ?? 0} />
                </td>
                <td className="hidden px-3 py-2 text-right font-mono text-[12px] tabular-nums sm:table-cell">
                  {trustScore(s)}
                </td>
                <td className="hidden px-3 py-2 text-right font-mono text-[11px] text-muted-foreground lg:table-cell">
                  {s.lastSync ? relativeTime(s.lastSync) : "—"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1.5">
                    <Switch
                      checked={s.enabled}
                      onCheckedChange={(v) => onPatch(s.id, { enabled: v })}
                      aria-label="Activă"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label="Editează"
                      onClick={() => onEdit(s)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="size-7" aria-label="Mai multe">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <a href={s.url} target="_blank" rel="noreferrer">
                            <ExternalLink className="size-4" />
                            Deschide feed-ul
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onPatch(s.id, { trusted: !s.trusted })}>
                          <ShieldCheck className="size-4" />
                          {s.trusted ? "Scoate din încredere" : "Marchează de încredere"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onPatch(s.id, { blocked: !s.blocked })}>
                          <Ban className="size-4" />
                          {s.blocked ? "Deblochează" : "Blochează"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-500"
                          onClick={() => onDelete(s)}
                        >
                          <Trash2 className="size-4" />
                          Șterge sursa
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
