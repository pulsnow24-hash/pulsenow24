"use client";

import { cn } from "@/lib/utils";

/** Grafic de bare pentru evoluția importurilor (dependency-free). */
export function BarChart({
  data,
  height = 96,
  className,
}: {
  data: { label: string; value: number }[];
  height?: number;
  className?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) {
    return (
      <div
        className={cn("flex items-center justify-center text-xs text-muted-foreground", className)}
        style={{ height }}
      >
        Fără date încă — rulează un import.
      </div>
    );
  }
  return (
    <div className={cn("flex items-end gap-1", className)} style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="group/bar flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="relative flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t bg-primary/70 transition-all duration-500 group-hover/bar:bg-primary"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 3 : 0 }}
            />
            <span className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 font-mono text-[9px] tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover/bar:opacity-100">
              {d.value}
            </span>
          </div>
          <span className="w-full truncate text-center font-mono text-[8px] text-muted-foreground/70">
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Donut pentru distribuția stării surselor. */
export function Donut({
  segments,
  size = 120,
  thickness = 14,
  centerLabel,
  centerSub,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;

  // Precalculăm arcurile (offset cumulativ) fără mutație în timpul randării
  const arcs: { seg: (typeof segments)[number]; len: number; offset: number }[] = [];
  let acc = 0;
  for (const seg of segments) {
    const len = (seg.value / total) * c;
    arcs.push({ seg, len, offset: acc });
    acc += len;
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={thickness}
            className="stroke-secondary"
          />
          {arcs.map((arc, i) => (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              strokeWidth={thickness}
              stroke={arc.seg.color}
              strokeDasharray={`${arc.len} ${c - arc.len}`}
              strokeDashoffset={-arc.offset}
              className="transition-[stroke-dasharray] duration-500"
            />
          ))}
        </svg>
        {centerLabel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-xl font-medium tabular-nums">
              {centerLabel}
            </span>
            {centerSub && (
              <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                {centerSub}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="size-2 rounded-full" style={{ background: seg.color }} />
            <span className="text-muted-foreground">{seg.label}</span>
            <span className="ml-auto font-mono tabular-nums">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Bară de sănătate compactă (0-100). */
export function HealthBar({ value }: { value: number }) {
  const color =
    value >= 75 ? "bg-emerald-500" : value >= 45 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-14 overflow-hidden rounded-full bg-secondary">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
        {value}
      </span>
    </div>
  );
}
