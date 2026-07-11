"use client";

/**
 * 📍 Monitor Vâlcea — dashboard-ul centrului de monitorizare locală.
 *
 * NU e un CMS și nu duplică motoarele: citește aceleași colecții (inbox,
 * stories, entities, sources, alerts) prin lentila workspace-ului Vâlcea.
 * Toate cifrele sunt reale; unde nu există date, o spunem explicit.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore/lite";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bell,
  Building2,
  Check,
  Flame,
  Landmark,
  MapPin,
  Megaphone,
  Newspaper,
  Plus,
  Radio,
  Rss,
  Tags,
  TrendingUp,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useNewsroom } from "../newsroom-provider";
import { loadEntities } from "@/lib/entity-store";
import { getActiveStories } from "@/lib/story-store";
import { loadSources } from "@/components/admin/automation/import-runner";
import {
  loadAlerts,
  loadWorkspaceConfig,
  saveWorkspaceConfig,
  setAlertStatus,
} from "@/lib/monitor-store";
import type { Entity } from "@/lib/engine/entity";
import type { RssSource } from "@/lib/engine/sources";
import type { Story } from "@/lib/engine/story";
import {
  ALERT_TYPE_LABELS,
  SOURCE_KIND_LABELS,
  coreValceaEntityIds,
  isLocalEntity,
  makeInstitution,
  matchKeywords,
  sourceSyncMode,
  type MonitorAlert,
  type WorkspaceConfig,
} from "@/lib/engine/workspace";
import {
  normalizeInboxDoc,
  type InboxDoc,
} from "@/components/admin/inbox/helpers";

/* ── Card generic (aceleași idiomuri ca dashboard-ul național) ── */

function Card({
  title,
  icon: Icon,
  meta,
  children,
  className,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  meta?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          <Icon className="size-3" />
          {title}
        </p>
        {meta && (
          <span className="font-mono text-[10px] text-muted-foreground">{meta}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[11.5px] text-muted-foreground/60">{children}</p>;
}

function Metric({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-mono text-xl font-medium tabular-nums", accent)}>{value}</p>
    </div>
  );
}

const SEVERITY_STYLE: Record<MonitorAlert["severity"], string> = {
  urgent: "border-red-500/40 bg-red-500/5 text-red-400",
  attention: "border-amber-500/40 bg-amber-500/5 text-amber-500",
  info: "border-border bg-secondary/40 text-muted-foreground",
};

/* ── Dashboard ─────────────────────────────────────────────── */

interface MonitorData {
  alerts: MonitorAlert[];
  alertsError: boolean;
  entities: Entity[];
  stories: Story[];
  sources: RssSource[];
  items: InboxDoc[];
}

export default function MonitorDashboard() {
  const { db } = useNewsroom();
  const [data, setData] = useState<MonitorData | null>(null);
  const [cfg, setCfg] = useState<WorkspaceConfig | null>(null);
  const [newKeyword, setNewKeyword] = useState("");
  const [newInstitution, setNewInstitution] = useState("");

  const reload = useCallback(async () => {
    const [cfgRes, alertsRes, entitiesRes, storiesRes, sourcesRes, inboxRes] =
      await Promise.allSettled([
        loadWorkspaceConfig(db),
        loadAlerts(db, "valcea"),
        loadEntities(db),
        getActiveStories(db),
        loadSources(db),
        getDocs(collection(db, "inbox")),
      ]);
    const config =
      cfgRes.status === "fulfilled" ? cfgRes.value : { keywords: [], institutions: [] };
    setCfg(config);
    setData({
      alerts: alertsRes.status === "fulfilled" ? alertsRes.value : [],
      alertsError: alertsRes.status === "rejected",
      entities: entitiesRes.status === "fulfilled" ? entitiesRes.value : [],
      stories: storiesRes.status === "fulfilled" ? storiesRes.value : [],
      sources: sourcesRes.status === "fulfilled" ? sourcesRes.value : [],
      items:
        inboxRes.status === "fulfilled"
          ? inboxRes.value.docs.map((d) => normalizeInboxDoc(d.id, d.data()))
          : [],
    });
  }, [db]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload().catch(() => {});
  }, [reload]);

  /* ── Lentila locală peste datele motoarelor ── */
  const view = useMemo(() => {
    if (!data || !cfg) return null;
    const core = coreValceaEntityIds(cfg);
    const localEntities = data.entities.filter(
      (e) => core.has(e.id) || isLocalEntity(e, cfg, core)
    );
    const institutionEntityIds = new Set(cfg.institutions.map((i) => i.entityId));
    const institutions = localEntities
      .filter((e) => e.type === "institution" || institutionEntityIds.has(e.id))
      .sort((a, b) => b.mentionCount - a.mentionCount);
    const localities = localEntities
      .filter((e) => ["county", "city", "location"].includes(e.type))
      .sort((a, b) => b.mentionCount - a.mentionCount);

    const localStories = data.stories
      .filter(
        (s) =>
          matchKeywords(
            [s.title, s.summary, ...s.entities, ...s.locations, ...s.organizations].join(" "),
            cfg.keywords
          ).length > 0
      )
      .sort(
        (a, b) =>
          b.breakingScore - a.breakingScore || b.lastUpdated.localeCompare(a.lastUpdated)
      );

    const localItems = data.items
      .filter(
        (i) =>
          i.workspaces?.includes("valcea") ||
          (!i.workspaces &&
            matchKeywords(`${i.titlu} ${i.descriere}`, cfg.keywords).length > 0)
      )
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt));

    const valceaSources = data.sources.filter((s) => s.workspace === "valcea");
    const activeSources = [...valceaSources]
      .filter((s) => sourceSyncMode(s.kind ?? "rss") === "feed")
      .sort((a, b) => (b.articlesToday ?? 0) - (a.articlesToday ?? 0));
    const sourcesByName = new Map(data.sources.map((s) => [s.name, s]));
    const institutionPosts = localItems.filter((i) => {
      const src = sourcesByName.get(i.sursa);
      return (
        src?.kind === "institution" ||
        (i.local && (i.local.institutions.length > 0 || i.local.institutionScore >= 40))
      );
    });
    const pressReleases = localItems.filter(
      (i) => sourcesByName.get(i.sursa)?.kind === "press-release"
    );
    const opportunities = localItems
      .filter((i) => i.local && i.local.commScore >= 60 && i.local.suggestion)
      .sort((a, b) => (b.local?.commScore ?? 0) - (a.local?.commScore ?? 0));

    const today = new Date().toISOString().slice(0, 10);
    return {
      localEntities,
      institutions,
      localities,
      localStories,
      localItems,
      valceaSources,
      activeSources,
      institutionPosts,
      pressReleases,
      opportunities,
      signalsToday: localItems.filter((i) => i.addedAt.startsWith(today)).length,
    };
  }, [data, cfg]);

  /* ── Configurare (cuvinte-cheie + instituții) ── */
  const saveConfig = useCallback(
    async (next: WorkspaceConfig) => {
      setCfg(next);
      try {
        await saveWorkspaceConfig(db, next);
      } catch {
        toast.error("Nu am putut salva configurația.");
      }
    },
    [db]
  );

  const dismissAlert = useCallback(
    async (id: string) => {
      setData((d) =>
        d ? { ...d, alerts: d.alerts.filter((a) => a.id !== id) } : d
      );
      try {
        await setAlertStatus(db, id, "dismissed");
      } catch {
        toast.error("Nu am putut închide alerta.");
      }
    },
    [db]
  );

  const azi = new Date().toLocaleDateString("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (!data || !cfg || !view) {
    return (
      <div className="p-6">
        <div className="h-40 animate-pulse rounded-xl border border-border bg-card" />
      </div>
    );
  }

  const newAlerts = data.alerts.filter((a) => a.status === "new");

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">📍 Monitor Vâlcea</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Centru de monitorizare și inteligență locală · {azi}
          </p>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">
          {cfg.keywords.length} cuvinte-cheie · {cfg.institutions.length} instituții ·{" "}
          {view.valceaSources.length} surse locale
        </p>
      </div>

      {/* Metrici */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Alerte active" value={newAlerts.length} accent={newAlerts.length > 0 ? "text-red-400" : undefined} />
        <Metric label="Semnale locale azi" value={view.signalsToday} />
        <Metric label="Semnale locale total" value={view.localItems.length} />
        <Metric label="Entități locale" value={view.localEntities.length} />
      </div>

      {/* Alerte live */}
      <Card
        title="Alerte live"
        icon={Bell}
        meta={`${newAlerts.length} noi · ${data.alerts.length} active`}
      >
        {data.alertsError ? (
          <Empty>
            Alertele nu pot fi citite încă — regulile Firestore pentru colecția
            „alerts” așteaptă instalarea.
          </Empty>
        ) : data.alerts.length === 0 ? (
          <Empty>
            Nicio alertă activă. Alertele se generează automat la import, din
            semnalele locale analizate de AI.
          </Empty>
        ) : (
          <div className="space-y-2">
            {data.alerts.slice(0, 6).map((a) => (
              <div
                key={a.id}
                className={cn(
                  "flex items-start gap-2 rounded-lg border p-2.5",
                  SEVERITY_STYLE[a.severity]
                )}
              >
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-[11px] font-medium uppercase tracking-wide">
                    {ALERT_TYPE_LABELS[a.type]}
                    <span className="font-mono text-[10px] font-normal normal-case opacity-70">
                      {a.sourceName} ·{" "}
                      {new Date(a.at).toLocaleString("ro-RO", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-foreground">{a.message}</p>
                  {a.suggestion && (
                    <p className="mt-1 text-[11.5px] italic opacity-80">
                      Sugestie AI: {a.suggestion}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => dismissAlert(a.id)}
                  className="shrink-0 rounded p-1 opacity-60 transition-opacity hover:opacity-100"
                  aria-label="Închide alerta"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Rândul 1: subiecte + oportunități */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Subiecte locale în trend"
          icon={Flame}
          meta={`${view.localStories.length} story-uri`}
        >
          {view.localStories.length === 0 ? (
            <Empty>Niciun story local activ. Se creează automat la import.</Empty>
          ) : (
            <div className="space-y-2">
              {view.localStories.slice(0, 6).map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-[12.5px]">
                  <span className="min-w-0 flex-1 truncate">{s.title}</span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {s.signalCount} semnale
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded px-1 font-mono text-[9px] uppercase",
                      s.breakingScore >= 70
                        ? "bg-red-500/10 text-red-400"
                        : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Oportunități de comunicare"
          icon={Megaphone}
          meta="recomandări AI — nu fapte"
        >
          {view.opportunities.length === 0 ? (
            <Empty>
              Nicio recomandare activă. Apar când AI-ul identifică subiecte care
              merită o comunicare oficială.
            </Empty>
          ) : (
            <div className="space-y-2.5">
              {view.opportunities.slice(0, 5).map((i) => (
                <div key={i.id} className="text-[12.5px]">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">{i.titlu}</span>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-primary">
                      {i.local?.commScore}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11.5px] italic text-muted-foreground">
                    {i.local?.suggestion}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Rândul 2: instituții + localități */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Instituții — cele mai menționate"
          icon={Landmark}
          meta="date live din Entity Engine"
        >
          {view.institutions.length === 0 ? (
            <Empty>
              Încă nicio mențiune a instituțiilor monitorizate în semnalele
              importate.
            </Empty>
          ) : (
            <div className="space-y-1">
              {view.institutions.slice(0, 8).map((e) => (
                <div key={e.id} className="flex items-center gap-2 text-[12.5px]">
                  <span className="min-w-0 flex-1 truncate">{e.name}</span>
                  {e.trendScore >= 60 && (
                    <TrendingUp className="size-3 shrink-0 text-emerald-500" />
                  )}
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {e.mentionCount}×
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Localități — cele mai menționate"
          icon={MapPin}
          meta="date live din Entity Engine"
        >
          {view.localities.length === 0 ? (
            <Empty>Încă nicio localitate vâlceană menționată în semnale.</Empty>
          ) : (
            <div className="space-y-1">
              {view.localities.slice(0, 8).map((e) => (
                <div key={e.id} className="flex items-center gap-2 text-[12.5px]">
                  <span className="min-w-0 flex-1 truncate">{e.name}</span>
                  {e.trendScore >= 60 && (
                    <TrendingUp className="size-3 shrink-0 text-emerald-500" />
                  )}
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {e.mentionCount}×
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Rândul 3: surse + semnale instituționale + comunicate */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Surse locale active" icon={Radio} meta={`${view.valceaSources.length} asignate`}>
          {view.valceaSources.length === 0 ? (
            <Empty>
              Nicio sursă asignată workspace-ului. Adaugă surse din Automatizare
              → workspace „Monitor Vâlcea”.
            </Empty>
          ) : (
            <div className="space-y-1.5">
              {view.activeSources.slice(0, 6).map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-[12.5px]">
                  <Rss className="size-3 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {s.articlesToday ?? 0} azi
                  </span>
                </div>
              ))}
              {view.valceaSources
                .filter((s) => sourceSyncMode(s.kind ?? "rss") === "connector")
                .slice(0, 4)
                .map((s) => (
                  <div key={s.id} className="flex items-center gap-2 text-[12.5px]">
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {s.name}
                    </span>
                    <span
                      className="shrink-0 rounded border border-amber-500/40 px-1 font-mono text-[9px] uppercase text-amber-500"
                      title={SOURCE_KIND_LABELS[s.kind ?? "rss"]}
                    >
                      Conector necesar
                    </span>
                  </div>
                ))}
            </div>
          )}
        </Card>

        <Card
          title="Ultimele semnale instituționale"
          icon={Building2}
          meta={`${view.institutionPosts.length} total`}
        >
          {view.institutionPosts.length === 0 ? (
            <Empty>
              Niciun semnal instituțional încă — apar când instituțiile
              monitorizate sunt implicate în semnale sau publică prin surse de
              tip „Instituție publică”.
            </Empty>
          ) : (
            <div className="space-y-1.5">
              {view.institutionPosts.slice(0, 5).map((i) => (
                <div key={i.id} className="text-[12.5px]">
                  <p className="truncate">{i.titlu}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {i.sursa}
                    {i.local?.institutions.length
                      ? ` · ${i.local.institutions.join(", ")}`
                      : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Ultimele comunicate de presă"
          icon={Newspaper}
          meta={`${view.pressReleases.length} total`}
        >
          {view.pressReleases.length === 0 ? (
            <Empty>
              Niciun comunicat — adaugă surse de tip „Comunicate de presă”
              (fluxurile RSS ale instituțiilor) în Automatizare.
            </Empty>
          ) : (
            <div className="space-y-1.5">
              {view.pressReleases.slice(0, 5).map((i) => (
                <div key={i.id} className="text-[12.5px]">
                  <p className="truncate">{i.titlu}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{i.sursa}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Configurare: instituții + cuvinte-cheie */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Instituții monitorizate"
          icon={Landmark}
          meta="listă configurabilă"
        >
          <div className="space-y-1">
            {cfg.institutions.map((inst) => {
              const live = data.entities.find((e) => e.id === inst.entityId);
              return (
                <div key={inst.id} className="flex items-center gap-2 text-[12.5px]">
                  <Check className="size-3 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate">{inst.name}</span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {live ? `${live.mentionCount}× menționată` : "fără mențiuni încă"}
                  </span>
                  <button
                    onClick={() =>
                      saveConfig({
                        ...cfg,
                        institutions: cfg.institutions.filter((x) => x.id !== inst.id),
                      })
                    }
                    className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-red-400"
                    aria-label={`Elimină ${inst.name}`}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              );
            })}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const name = newInstitution.trim();
              if (!name) return;
              if (cfg.institutions.some((i) => i.name.toLowerCase() === name.toLowerCase())) {
                toast.info("Instituția e deja monitorizată.");
                return;
              }
              saveConfig({ ...cfg, institutions: [...cfg.institutions, makeInstitution(name)] });
              setNewInstitution("");
            }}
          >
            <Input
              value={newInstitution}
              onChange={(e) => setNewInstitution(e.target.value)}
              placeholder="Adaugă instituție…"
              className="h-8 text-xs"
            />
            <Button type="submit" size="sm" variant="outline">
              <Plus className="size-3.5" />
            </Button>
          </form>
        </Card>

        <Card title="Cuvinte-cheie urmărite" icon={Tags} meta="nelimitat">
          <div className="flex flex-wrap gap-1.5">
            {cfg.keywords.map((kw) => (
              <span
                key={kw}
                className="flex items-center gap-1 rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[11.5px]"
              >
                {kw}
                <button
                  onClick={() =>
                    saveConfig({ ...cfg, keywords: cfg.keywords.filter((k) => k !== kw) })
                  }
                  className="text-muted-foreground transition-colors hover:text-red-400"
                  aria-label={`Elimină ${kw}`}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const kw = newKeyword.trim();
              if (!kw) return;
              if (cfg.keywords.some((k) => k.toLowerCase() === kw.toLowerCase())) {
                toast.info("Cuvântul-cheie există deja.");
                return;
              }
              saveConfig({ ...cfg, keywords: [...cfg.keywords, kw] });
              setNewKeyword("");
            }}
          >
            <Input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="Adaugă cuvânt-cheie…"
              className="h-8 text-xs"
            />
            <Button type="submit" size="sm" variant="outline">
              <Plus className="size-3.5" />
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
