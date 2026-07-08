import type { LucideIcon } from "lucide-react";

export default function SectionPlaceholder({
  icon: Icon,
  title,
  description,
  phase,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-border bg-card">
          <Icon className="size-5 text-muted-foreground" />
        </div>
        <h1 className="mt-5 text-lg font-medium tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-[11px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          {phase}
        </p>
      </div>
    </div>
  );
}
