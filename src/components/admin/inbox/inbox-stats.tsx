"use client";

import { cn } from "@/lib/utils";
import type { InboxDoc } from "./helpers";

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function InboxStats({ items }: { items: InboxDoc[] }) {
  const stats = [
    { label: "Azi importate", value: items.filter((i) => isToday(i.addedAt)).length },
    {
      label: "Aprobate",
      value: items.filter((i) => i.status === "approved").length,
      accent: "text-emerald-400",
    },
    {
      label: "Respinse",
      value: items.filter((i) => i.status === "rejected").length,
      accent: "text-zinc-400",
    },
    {
      label: "Breaking",
      value: items.filter((i) => i.priority === "breaking").length,
      accent: "text-red-500",
    },
    { label: "Scor AI mediu", value: avg(items.map((i) => i.importanceScore)) },
    { label: "Trust mediu", value: avg(items.map((i) => i.trustScore)) },
    { label: "SEO mediu", value: avg(items.map((i) => i.seoScore)) },
  ];

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4 lg:grid-cols-7">
      {stats.map((s) => (
        <div key={s.label} className="bg-card px-4 py-3">
          <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {s.label}
          </div>
          <div
            className={cn(
              "mt-1 font-mono text-xl font-medium tabular-nums",
              s.accent ?? "text-foreground"
            )}
          >
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}
