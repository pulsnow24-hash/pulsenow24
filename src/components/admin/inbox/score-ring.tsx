import { cn } from "@/lib/utils";
import { scoreColor } from "./helpers";

/** Inel de progres pentru scorul principal (importanță). */
export function ScoreRing({
  value,
  size = 46,
  stroke = 3.5,
  colorClass,
}: {
  value: number;
  size?: number;
  stroke?: number;
  colorClass?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, value)) / 100);
  const color = colorClass ?? scoreColor(value);

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-label={`Scor ${value}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-border"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={cn("transition-[stroke-dashoffset] duration-500", color)}
          stroke="currentColor"
        />
      </svg>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center font-mono text-sm font-medium tabular-nums",
          color
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** Metrică compactă: etichetă mică deasupra, valoare colorată dedesubt. */
export function ScoreStat({
  label,
  value,
  colorClass,
  suffix,
}: {
  label: string;
  value: number | string;
  colorClass?: string;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-[13px] font-medium tabular-nums",
          colorClass ?? "text-foreground"
        )}
      >
        {value}
        {suffix}
      </span>
    </div>
  );
}
