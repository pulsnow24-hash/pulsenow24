"use client";

/**
 * 📍 Monitor Vâlcea — dashboard-ul centrului de monitorizare locală.
 *
 * NU e un CMS și nu duplică motoarele: citește aceleași colecții (inbox,
 * stories, entities, sources, alerts) prin lentila workspace-ului Vâlcea.
 * Toate cifrele sunt reale; unde nu există date, o spunem explicit.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, setDoc } from "firebase/firestore/lite";
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
import { callApi } from "@/app/admin/api";
import {
  loadAlerts,
  loadBriefHistory,
  loadStoryCoverage,
  loadWorkflow,
  loadWorkspaceConfig,
  saveWorkspaceConfig,
  setAlertStatus,
} from "@/lib/monitor-store";
import type { DailyBrief, WorkflowItem } from "@/lib/engine/workflow";
import { normalizeAlias, type Entity } from "@/lib/engine/entity";
import {
  CONFIDENCE_LABELS,
  computeConfidence,
} from "@/lib/engine/confidence";
import { newSource, trustScore, type RssSource } from "@/lib/engine/sources";
import type { Story } from "@/lib/engine/story";
import {
  ALERT_TYPE_LABELS,
  CONSISTENCY_LABELS,
  SINGLE_SOURCE_LABEL,
  SOURCE_CATEGORIES,
  SOURCE_CATEGORY_LABELS,
  SOURCE_KIND_LABELS,
  VALCEA_STARTER_SOURCES,
  computeCoverageGaps,
  computeStoryCoverage,
  coreValceaEntityIds,
  isLocalEntity,
  makeInstitution,
  matchKeywords,
  sourceSyncMode,
  type MonitorAlert,
  type StoryCoverageDoc,
  type WorkspaceConfig,
} from "@/lib/engine/workspace";
import {
  normalizeInboxDoc,
  type InboxDoc,
} from "@/components/admin/inbox/helpers";
import {
  EntityContextSheet,
  StoryContextSheet,
} from "./context-sheets";
import OperationalPanel from "./operational-panel";

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
  /** null = necititbil (regulile story_coverage încă neinstalate) */
  coverage: Map<string, StoryCoverageDoc> | null;
  /** null = necititbil (regulile workflow încă neinstalate) */
  workflow: Map<string, WorkflowItem> | null;
  briefHistory: DailyBrief[];
}

export default function MonitorDashboard() {
  const { db, auth } = useNewsroom();
  const [data, setData] = useState<MonitorData | null>(null);
  const [cfg, setCfg] = useState<WorkspaceConfig | null>(null);
  const [newKeyword, setNewKeyword] = useState("");
  const [newInstitution, setNewInstitution] = useState("");
  const [contextEntity, setContextEntity] = useState<Entity | null>(null);
  const [contextStory, setContextStory] = useState<Story | null>(null);

  const reload = useCallback(async () => {
    const [
      cfgRes,
      alertsRes,
      entitiesRes,
      storiesRes,
      sourcesRes,
      inboxRes,
      covRes,
      wfRes,
      briefRes,
    ] = await Promise.allSettled([
      loadWorkspaceConfig(db),
      loadAlerts(db, "valcea"),
      loadEntities(db),
      getActiveStories(db),
      loadSources(db),
      getDocs(collection(db, "inbox")),
      loadStoryCoverage(db, "valcea"),
      loadWorkflow(db, "valcea"),
      loadBriefHistory(db, "valcea"),
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
      coverage: covRes.status === "fulfilled" ? covRes.value : null,
      workflow: wfRes.status === "fulfilled" ? wfRes.value : null,
      briefHistory: briefRes.status === "fulfilled" ? briefRes.value : [],
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

    const gaps = computeCoverageGaps(valceaSources, cfg);
    const categoryStats = SOURCE_CATEGORIES.map((c) => {
      const inCat = valceaSources.filter((s) => s.sourceCategory === c);
      return {
        category: c,
        total: inCat.length,
        active: inCat.filter((s) => s.enabled).length,
        feed: inCat.filter((s) => sourceSyncMode(s.kind ?? "rss") === "feed" && s.url).length,
        connector: inCat.filter((s) => sourceSyncMode(s.kind ?? "rss") === "connector" || !s.url).length,
      };
    }).filter((c) => c.total > 0);

    const today = new Date().toISOString().slice(0, 10);
    return {
      gaps,
      categoryStats,
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

  const [seeding, setSeeding] = useState(false);

  /** Adaugă lista de start Vâlcea: fiecare feed e VALIDAT înainte de activare. */
  const seedStarter = useCallback(async () => {
    if (!data || seeding) return;
    setSeeding(true);
    try {
      const existing = new Set(data.sources.map((s) => normalizeAlias(s.name)));
      let added = 0;
      let validated = 0;
      let connector = 0;
      let skipped = 0;
      for (const starter of VALCEA_STARTER_SOURCES) {
        if (existing.has(normalizeAlias(starter.name))) {
          skipped++;
          continue;
        }
        let kind = starter.kind;
        let enabled = false;
        let notes = starter.notes;
        const isFeed = sourceSyncMode(starter.kind) === "feed" && starter.url;
        if (isFeed) {
          try {
            const r = await callApi<{ valid: boolean; error?: string }>(
              auth,
              "/api/sources/validate",
              { url: starter.url },
              30_000
            );
            if (r.valid) {
              enabled = true;
              validated++;
            } else {
              kind = "website";
              notes = `${starter.notes} Feed indisponibil la validare — trecut pe conector.`;
            }
          } catch {
            kind = "website";
            notes = `${starter.notes} Validarea feed-ului a eșuat — trecut pe conector.`;
          }
        }
        if (!enabled && sourceSyncMode(kind) === "connector") connector++;
        const id =
          normalizeAlias(starter.name).replace(/ /g, "-").slice(0, 40) ||
          `sursa-${Date.now()}`;
        await setDoc(
          doc(db, "sources", id),
          newSource({
            name: starter.name,
            url: starter.url,
            category: "Actualitate",
            countryCode: "RO",
            kind,
            workspace: "valcea",
            sourceCategory: starter.sourceCategory,
            ...(starter.locality ? { locality: starter.locality } : {}),
            notes,
            enabled,
            trusted: false,
          })
        );
        added++;
      }
      toast.success(
        `Listă de start: ${added} surse adăugate (${validated} feed-uri validate, ${connector} cu conector necesar${skipped ? `, ${skipped} existente sărite` : ""}).`
      );
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSeeding(false);
    }
  }, [data, seeding, auth, db, reload]);

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

      {/* Panou operațional: Brief zilnic + Coadă de prioritate + acțiuni.
          Scopat pe story-urile LOCALE — Monitor Vâlcea nu atinge naționalul. */}
      <OperationalPanel
        db={db}
        auth={auth}
        stories={view.localStories}
        coverage={data.coverage}
        items={data.items}
        alerts={data.alerts}
        workflow={data.workflow}
        briefHistory={data.briefHistory}
        onReload={() => reload().catch(() => {})}
        onOpenStory={(s) => setContextStory(s)}
      />

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
            <div className="space-y-2.5">
              {view.localStories.slice(0, 6).map((s) => {
                const cov = computeStoryCoverage(s.sources, data.sources);
                const conflict = data.coverage?.get(s.id);
                const byName = new Map(data.sources.map((x) => [x.name, x]));
                const confidence = computeConfidence({
                  coverage: cov,
                  sourceTrust: s.sources
                    .map((n) => byName.get(n))
                    .filter((x): x is RssSource => !!x)
                    .map((x) => trustScore(x)),
                  verdict: conflict?.consistencyDetail ?? "unchecked",
                  lastUpdated: s.lastUpdated,
                });
                return (
                  <div key={s.id} className="text-[12.5px]">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setContextStory(s)}
                        className="min-w-0 flex-1 truncate text-left transition-colors hover:text-primary"
                      >
                        {s.title}
                      </button>
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
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                      <span className="text-muted-foreground">
                        {cov.independentSources}{" "}
                        {cov.independentSources === 1 ? "sursă" : "surse"} ·{" "}
                        {cov.officialCount} oficiale · {cov.pressCount} presă ·{" "}
                        {cov.socialCount} sociale
                      </span>
                      {cov.singleSource ? (
                        <span className="rounded border border-amber-500/40 px-1 py-px uppercase text-amber-500">
                          {SINGLE_SOURCE_LABEL}
                        </span>
                      ) : (
                        <span className="rounded border border-emerald-500/40 px-1 py-px uppercase text-emerald-500">
                          Coroborat · diversitate {cov.diversityScore}
                        </span>
                      )}
                      {cov.corroborated &&
                        (conflict?.consistencyDetail ? (
                          <span
                            className={cn(
                              "rounded border px-1 py-px uppercase",
                              conflict.consistencyDetail === "contradiction"
                                ? "border-red-500/40 text-red-400"
                                : conflict.consistencyDetail === "update"
                                  ? "border-sky-500/40 text-sky-400"
                                  : "border-border text-muted-foreground"
                            )}
                            title={conflict.conflictNote}
                          >
                            {CONSISTENCY_LABELS[conflict.consistencyDetail]}
                          </span>
                        ) : conflict?.conflict === "conflicting" ? (
                          <span
                            className="rounded border border-red-500/40 px-1 py-px uppercase text-red-400"
                            title={conflict.conflictNote}
                          >
                            Surse în contradicție
                          </span>
                        ) : conflict?.conflict === "consistent" ? (
                          <span className="rounded border border-border px-1 py-px uppercase text-muted-foreground">
                            Fără contradicții
                          </span>
                        ) : (
                          <span className="rounded border border-border px-1 py-px uppercase text-muted-foreground/60">
                            Contradicții: neverificat
                          </span>
                        ))}
                      <span
                        className={cn(
                          "rounded px-1 py-px font-medium uppercase",
                          confidence.label === "high"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : confidence.label === "medium"
                              ? "bg-amber-500/10 text-amber-500"
                              : "bg-red-500/10 text-red-400"
                        )}
                        title={`Surse: ${confidence.parts.sources} · Diversitate: ${confidence.parts.diversity} · Oficiale: ${confidence.parts.official} · Trust: ${confidence.parts.trust} · Consistență: ${confidence.parts.consistency} · Prospețime: ${confidence.parts.freshness}`}
                      >
                        {CONFIDENCE_LABELS[confidence.label]} · {confidence.score}
                      </span>
                    </div>
                  </div>
                );
              })}
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
                  <button
                    onClick={() => setContextEntity(e)}
                    className="min-w-0 flex-1 truncate text-left transition-colors hover:text-primary"
                  >
                    {e.name}
                  </button>
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
                  <button
                    onClick={() => setContextEntity(e)}
                    className="min-w-0 flex-1 truncate text-left transition-colors hover:text-primary"
                  >
                    {e.name}
                  </button>
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

      {/* Acoperire surse: categorii, lacune, listă de start */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          title="Surse pe categorii"
          icon={Radio}
          meta={`${view.valceaSources.length} total · ${view.valceaSources.filter((s) => s.enabled).length} active`}
        >
          {view.categoryStats.length === 0 ? (
            <Empty>Nicio sursă categorisită încă — folosește lista de start.</Empty>
          ) : (
            <div className="space-y-1">
              {view.categoryStats.map((c) => (
                <div key={c.category} className="flex items-center gap-2 text-[12px]">
                  <span className="min-w-0 flex-1 truncate">
                    {SOURCE_CATEGORY_LABELS[c.category]}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {c.active}/{c.total} active
                  </span>
                  {c.feed > 0 && (
                    <span className="shrink-0 rounded bg-emerald-500/10 px-1 font-mono text-[9px] uppercase text-emerald-500">
                      {c.feed} RSS
                    </span>
                  )}
                  {c.connector > 0 && (
                    <span className="shrink-0 rounded bg-amber-500/10 px-1 font-mono text-[9px] uppercase text-amber-500">
                      {c.connector} conector
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Lacune de acoperire"
          icon={AlertTriangle}
          meta="ce nu monitorizăm încă"
        >
          <div className="space-y-2 text-[12px]">
            <div>
              <p className="font-mono text-[10px] uppercase text-muted-foreground">
                Instituții fără sursă ({view.gaps.institutionsWithoutSource.length})
              </p>
              <p className="text-muted-foreground">
                {view.gaps.institutionsWithoutSource.join(" · ") || "— toate au surse"}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase text-muted-foreground">
                Localități fără sursă ({view.gaps.localitiesWithoutSource.length})
              </p>
              <p className="text-muted-foreground">
                {view.gaps.localitiesWithoutSource.join(" · ") || "— toate acoperite"}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase text-muted-foreground">
                Categorii goale ({view.gaps.emptyCategories.length})
              </p>
              <p className="text-muted-foreground">
                {view.gaps.emptyCategories.map((c) => SOURCE_CATEGORY_LABELS[c]).join(" · ") || "—"}
              </p>
            </div>
          </div>
        </Card>

        <Card title="Lista de start Vâlcea" icon={Plus} meta={`${VALCEA_STARTER_SOURCES.length} surse curate`}>
          <p className="text-[11.5px] text-muted-foreground">
            Catalog multi-sursă verificat manual: presă locală, instituții
            județene, primării, urgențe, sănătate, utilități și pagini sociale.
            Fiecare feed e <strong>validat înainte de activare</strong>; sursele
            fără flux sunt marcate „Conector necesar”, iar cele fără URL
            verificabil rămân de completat. Nicio publicație nu e tratată ca
            autoritate.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={seedStarter}
            disabled={seeding || !data}
          >
            <Plus className="size-3.5" />
            {seeding ? "Validez și adaug…" : "Adaugă sursele de start"}
          </Button>
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

      <EntityContextSheet
        entity={contextEntity}
        entities={data.entities}
        stories={data.stories}
        alerts={data.alerts}
        onClose={() => setContextEntity(null)}
        onOpenStory={(s) => {
          setContextEntity(null);
          setContextStory(s);
        }}
      />
      <StoryContextSheet
        story={contextStory}
        stories={data.stories}
        entities={data.entities}
        sources={data.sources}
        coverage={data.coverage}
        db={db}
        onClose={() => setContextStory(null)}
        onOpenStory={(s) => setContextStory(s)}
        onOpenEntity={(e) => {
          setContextStory(null);
          setContextEntity(e);
        }}
        onChanged={() => reload().catch(() => {})}
      />
    </div>
  );
}
