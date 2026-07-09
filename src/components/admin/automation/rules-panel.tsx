"use client";

import {
  Zap,
  Timer,
  Gauge,
  ShieldCheck,
  Flame,
  FileEdit,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AutomationConfig } from "@/lib/engine/sources";

function RuleCard({
  icon: Icon,
  title,
  desc,
  enabled,
  onToggle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  enabled?: boolean;
  onToggle?: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium">{title}</p>
          <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{desc}</p>
        </div>
        {onToggle && (
          <Switch checked={enabled} onCheckedChange={onToggle} className="mt-0.5" />
        )}
      </div>
      {children && enabled !== false && (
        <div className="mt-3 space-y-2 border-t border-border/60 pt-3">{children}</div>
      )}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-[12px] text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-7 w-20 text-right font-mono text-xs"
        />
        {suffix && (
          <span className="w-8 font-mono text-[11px] text-muted-foreground">{suffix}</span>
        )}
      </div>
    </div>
  );
}

export default function RulesPanel({
  config,
  onChange,
}: {
  config: AutomationConfig;
  onChange: (patch: Partial<AutomationConfig>) => void;
}) {
  const patchRules = (patch: Partial<AutomationConfig["rules"]>) =>
    onChange({ rules: { ...config.rules, ...patch } });

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <RuleCard
        icon={Timer}
        title="Import automat"
        desc="Rulează importul la interval, cât timp panoul e deschis. Pentru automatizare non-stop, folosește un cron care apelează endpointul."
        enabled={config.autoRefresh}
        onToggle={(v) => onChange({ autoRefresh: v })}
      >
        <NumField
          label="Interval"
          value={config.intervalMinutes}
          onChange={(v) => onChange({ intervalMinutes: Math.max(5, v) })}
          suffix="min"
        />
      </RuleCard>

      <RuleCard
        icon={Gauge}
        title="Rate limiting"
        desc="Numărul maxim de articole adăugate într-o singură rulare de import."
      >
        <NumField
          label="Max / rulare"
          value={config.maxPerRun}
          onChange={(v) => onChange({ maxPerRun: Math.max(1, v) })}
        />
      </RuleCard>

      <RuleCard
        icon={ShieldCheck}
        title="Aprobare AI automată"
        desc="Aprobă direct în inbox articolele care trec pragurile de importanță și trust."
        enabled={config.rules.autoApprove.enabled}
        onToggle={(v) =>
          patchRules({ autoApprove: { ...config.rules.autoApprove, enabled: v } })
        }
      >
        <NumField
          label="Importanță min."
          value={config.rules.autoApprove.minImportance}
          onChange={(v) =>
            patchRules({ autoApprove: { ...config.rules.autoApprove, minImportance: v } })
          }
        />
        <NumField
          label="Trust min."
          value={config.rules.autoApprove.minTrust}
          onChange={(v) =>
            patchRules({ autoApprove: { ...config.rules.autoApprove, minTrust: v } })
          }
        />
        <div className="flex items-center justify-between gap-3">
          <Label className="text-[12px] text-muted-foreground">Doar surse de încredere</Label>
          <Switch
            checked={config.rules.autoApprove.trustedOnly}
            onCheckedChange={(v) =>
              patchRules({ autoApprove: { ...config.rules.autoApprove, trustedOnly: v } })
            }
          />
        </div>
      </RuleCard>

      <RuleCard
        icon={Flame}
        title="Reguli Breaking News"
        desc="AI-ul marchează breaking; regula filtrează pragul minim de importanță afișat ca breaking."
        enabled={config.rules.breaking.enabled}
        onToggle={(v) =>
          patchRules({ breaking: { ...config.rules.breaking, enabled: v } })
        }
      >
        <NumField
          label="Importanță min."
          value={config.rules.breaking.minImportance}
          onChange={(v) =>
            patchRules({ breaking: { ...config.rules.breaking, minImportance: v } })
          }
        />
      </RuleCard>

      <RuleCard
        icon={FileEdit}
        title="Reguli draft automat"
        desc="Semnalează în inbox candidații pentru generare automată de draft (nu generează singur, pentru control editorial)."
        enabled={config.rules.autoDraft.enabled}
        onToggle={(v) =>
          patchRules({ autoDraft: { ...config.rules.autoDraft, enabled: v } })
        }
      >
        <NumField
          label="Importanță min."
          value={config.rules.autoDraft.minImportance}
          onChange={(v) =>
            patchRules({ autoDraft: { ...config.rules.autoDraft, minImportance: v } })
          }
        />
        <div className="flex items-center justify-between gap-3">
          <Label className="text-[12px] text-muted-foreground">Doar surse de încredere</Label>
          <Switch
            checked={config.rules.autoDraft.trustedOnly}
            onCheckedChange={(v) =>
              patchRules({ autoDraft: { ...config.rules.autoDraft, trustedOnly: v } })
            }
          />
        </div>
      </RuleCard>

      <RuleCard
        icon={Zap}
        title="AI scoring & categorizare"
        desc="Fiecare articol importat primește automat scor de importanță, trust, viral, SEO, risc de fake news, categorie, țară și detecție de dubluri — la fiecare import."
      />
    </div>
  );
}
