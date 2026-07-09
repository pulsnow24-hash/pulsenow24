"use client";

import { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Zap,
  Hand,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImportLog } from "@/lib/engine/sources";
import { relativeTime } from "@/components/admin/inbox/helpers";

function LogRow({ log }: { log: ImportLog }) {
  const [open, setOpen] = useState(false);
  const hasErrors = log.errors.length > 0;
  return (
    <div className="border-b border-border/60 last:border-0">
      <button
        onClick={() => hasErrors && setOpen(!open)}
        className={cn(
          "flex w-full items-center gap-3 px-3 py-2.5 text-left",
          hasErrors && "cursor-pointer hover:bg-accent/40"
        )}
      >
        {hasErrors ? (
          <AlertTriangle className="size-4 shrink-0 text-amber-400" />
        ) : (
          <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
        )}
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-muted-foreground">
          {log.trigger === "auto" ? (
            <Zap className="size-3" />
          ) : (
            <Hand className="size-3" />
          )}
          {log.trigger === "auto" ? "Auto" : "Manual"}
        </span>
        <span className="text-[13px]">
          <span className="font-medium tabular-nums">{log.itemsAdded}</span>
          <span className="text-muted-foreground"> adăugate</span>
          {log.autoApproved > 0 && (
            <span className="text-emerald-400"> · {log.autoApproved} aprobate</span>
          )}
        </span>
        <span className="ml-auto flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
          <span>{log.sourcesChecked} surse</span>
          <span>{(log.durationMs / 1000).toFixed(1)}s</span>
          <span>{relativeTime(log.at)}</span>
          {hasErrors && (
            <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
          )}
        </span>
      </button>
      {open && hasErrors && (
        <div className="space-y-1 bg-secondary/30 px-3 pb-2.5 pl-10">
          {log.errors.map((e, i) => (
            <p key={i} className="text-[12px] text-red-400">
              <span className="font-medium">{e.source}</span>
              <span className="text-muted-foreground"> — {e.message}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HistoryPanel({ logs }: { logs: ImportLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
        {"Niciun import încă. Apasă „Rulează import” ca să pornești fluxul."}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {logs.map((log) => (
        <LogRow key={log.id} log={log} />
      ))}
    </div>
  );
}
