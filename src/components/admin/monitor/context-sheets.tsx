"use client";

/**
 * Panourile de context ale Monitorului: memoria unei entități și
 * contextul unui story. Totul e calculat determinist din datele
 * motoarelor existente (Context Engine) — explicabil, fără date simulate.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Building2,
  Clock,
  GitMerge,
  Link2,
  MapPin,
  Network,
  Tags,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Firestore } from "firebase/firestore/lite";
import { doc, deleteDoc, updateDoc } from "firebase/firestore/lite";
import {
  ENTITY_TYPE_LABELS,
  currentRelations,
  relationKindLabel,
  type Entity,
} from "@/lib/engine/entity";
import { mergeStories, type Story } from "@/lib/engine/story";
import {
  CONFIDENCE_LABELS,
  computeConfidence,
} from "@/lib/engine/confidence";
import {
  TIMELINE_KIND_LABELS,
  buildEntityMemory,
  buildEntityTimeline,
  buildStoryContext,
  type RelatedStory,
} from "@/lib/engine/context";
import {
  computeStoryCoverage,
  type MonitorAlert,
  type StoryCoverageDoc,
} from "@/lib/engine/workspace";
import { trustScore, type RssSource } from "@/lib/engine/sources";
import { saveStory } from "@/lib/story-store";
import { saveStoryCoverage } from "@/lib/monitor-store";

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3" />
        {title}
      </p>
      {children}
    </div>
  );
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[11px]",
        className
      )}
    >
      {children}
    </span>
  );
}

const fmtDate = (iso: string) =>
  iso
    ? new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" })
    : "—";

/* ── Contextul unei entități ───────────────────────────────── */

export function EntityContextSheet({
  entity,
  entities,
  stories,
  alerts,
  onClose,
  onOpenStory,
}: {
  entity: Entity | null;
  entities: Entity[];
  stories: Story[];
  alerts: MonitorAlert[];
  onClose: () => void;
  onOpenStory: (s: Story) => void;
}) {
  const view = useMemo(() => {
    if (!entity) return null;
    const now = new Date().toISOString();
    const memory = buildEntityMemory(entity, stories);
    const timeline = buildEntityTimeline(entity, stories, alerts);
    const byId = new Map(entities.map((e) => [e.id, e]));
    const relations = currentRelations(entity, now)
      .map((r) => ({ ...r, other: byId.get(r.entityId) }))
      .filter((r) => r.other)
      .slice(0, 8);
    const months = Object.entries(entity.monthlyMentions ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12);
    return { memory, timeline, relations, months };
  }, [entity, entities, stories, alerts]);

  if (!entity || !view) return null;
  const maxMonth = Math.max(1, ...view.months.map(([, n]) => n));

  return (
    <Sheet open={!!entity} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-base">
            {entity.name}
            <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
              {ENTITY_TYPE_LABELS[entity.type]}
            </span>
          </SheetTitle>
          <p className="font-mono text-[11px] text-muted-foreground">
            {entity.mentionCount} mențiuni · prima {fmtDate(entity.firstSeen)} ·
            ultima {fmtDate(entity.lastSeen)} · trend {entity.trendScore}
          </p>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-8">
          {view.months.length > 0 && (
            <Section title="Mențiuni pe luni (memorie)" icon={Clock}>
              <div className="flex items-end gap-1" aria-label="Trend lunar">
                {view.months.map(([m, n]) => (
                  <div key={m} className="flex flex-col items-center gap-0.5" title={`${m}: ${n} mențiuni`}>
                    <div
                      className="w-4 rounded-sm bg-primary/60"
                      style={{ height: `${Math.max(3, (n / maxMonth) * 44)}px` }}
                    />
                    <span className="font-mono text-[8px] text-muted-foreground">
                      {m.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title="Co-menționate (asocieri observate)" icon={Network}>
            {view.relations.length === 0 ? (
              <p className="text-[11.5px] text-muted-foreground/60">
                Încă nicio co-menționare — se acumulează automat la import.
              </p>
            ) : (
              <>
                <p className="mb-1.5 text-[10.5px] leading-snug text-muted-foreground/70">
                  Apariții împreună în story-uri stocate — nu relații personale,
                  politice sau juridice confirmate.
                </p>
                <div className="space-y-1">
                  {view.relations.map((r) => (
                    <div key={r.entityId} className="flex items-center gap-2 text-[12.5px]">
                      <span className="min-w-0 flex-1 truncate">{r.other!.name}</span>
                      <span className="shrink-0 font-mono text-[9px] uppercase text-muted-foreground">
                        {relationKindLabel(entity.type, r.other!.type)}
                      </span>
                      <span
                        className="shrink-0 font-mono text-[10px] text-muted-foreground"
                        title={`Forța asocierii (co-ocurență cu decay temporal): ${r.weight}/100 · prima ${fmtDate(r.firstSeen)} · ultima ${fmtDate(r.lastSeen)}`}
                      >
                        împreună în {r.count} {r.count === 1 ? "story" : "story-uri"}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Section>

          {view.memory.recurringTopics.length > 0 && (
            <Section title="Teme recurente" icon={Tags}>
              <div className="flex flex-wrap gap-1.5">
                {view.memory.recurringTopics.map((t) => (
                  <Chip key={t.name}>
                    {t.name} <span className="text-muted-foreground">×{t.count}</span>
                  </Chip>
                ))}
              </div>
            </Section>
          )}
          {view.memory.recurringLocations.length > 0 && (
            <Section title="Locuri recurente" icon={MapPin}>
              <div className="flex flex-wrap gap-1.5">
                {view.memory.recurringLocations.map((t) => (
                  <Chip key={t.name}>
                    {t.name} <span className="text-muted-foreground">×{t.count}</span>
                  </Chip>
                ))}
              </div>
            </Section>
          )}
          {view.memory.recurringOrganizations.length > 0 && (
            <Section title="Organizații recurente" icon={Building2}>
              <div className="flex flex-wrap gap-1.5">
                {view.memory.recurringOrganizations.map((t) => (
                  <Chip key={t.name}>
                    {t.name} <span className="text-muted-foreground">×{t.count}</span>
                  </Chip>
                ))}
              </div>
            </Section>
          )}

          <Section title="Cronologie locală" icon={Clock}>
            {view.timeline.length === 0 ? (
              <p className="text-[11.5px] text-muted-foreground/60">
                Niciun eveniment înregistrat încă.
              </p>
            ) : (
              <div className="space-y-1.5">
                {view.timeline.slice(0, 12).map((e, i) => (
                  <div key={i} className="text-[12px]">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "shrink-0 rounded px-1 font-mono text-[9px] uppercase",
                          e.kind === "incident"
                            ? "bg-red-500/10 text-red-400"
                            : e.kind === "investment"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-secondary text-muted-foreground"
                        )}
                      >
                        {TIMELINE_KIND_LABELS[e.kind]}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {fmtDate(e.at)} · {e.source}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate">{e.title}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {view.memory.stories.length > 0 && (
            <Section title="Story-urile entității" icon={Link2}>
              <div className="space-y-1">
                {view.memory.stories.slice(0, 6).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onOpenStory(s)}
                    className="flex w-full items-center gap-1.5 text-left text-[12.5px] text-foreground transition-colors hover:text-primary"
                  >
                    <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">{s.title}</span>
                  </button>
                ))}
              </div>
            </Section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ── Contextul unui story ──────────────────────────────────── */

function RelatedList({
  items,
  onOpenStory,
  empty,
}: {
  items: RelatedStory[];
  onOpenStory: (s: Story) => void;
  empty: string;
}) {
  if (items.length === 0)
    return <p className="text-[11.5px] text-muted-foreground/60">{empty}</p>;
  return (
    <div className="space-y-1.5">
      {items.map((r) => (
        <div key={r.story.id} className="text-[12.5px]">
          <button
            onClick={() => onOpenStory(r.story)}
            className="flex w-full items-center gap-1.5 text-left transition-colors hover:text-primary"
          >
            <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
            <span className="truncate">{r.story.title}</span>
          </button>
          <p className="ml-4 truncate font-mono text-[10px] text-muted-foreground">
            {fmtDate(r.story.lastUpdated)} · comune: {r.sharedEntities.slice(0, 4).join(", ")}
          </p>
        </div>
      ))}
    </div>
  );
}

export function StoryContextSheet({
  story,
  stories,
  entities,
  sources,
  coverage,
  db,
  onClose,
  onOpenStory,
  onOpenEntity,
  onChanged,
}: {
  story: Story | null;
  stories: Story[];
  entities: Entity[];
  sources: RssSource[];
  coverage: Map<string, StoryCoverageDoc> | null;
  db: Firestore;
  onClose: () => void;
  onOpenStory: (s: Story) => void;
  onOpenEntity: (e: Entity) => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const view = useMemo(() => {
    if (!story) return null;
    const ctx = buildStoryContext(story, stories, entities);
    const cov = computeStoryCoverage(story.sources, sources);
    const byName = new Map(sources.map((x) => [x.name, x]));
    const covDoc = coverage?.get(story.id);
    const confidence = computeConfidence({
      coverage: cov,
      sourceTrust: story.sources
        .map((n) => byName.get(n))
        .filter((x): x is RssSource => !!x)
        .map((x) => trustScore(x)),
      verdict: covDoc?.consistencyDetail ?? "unchecked",
      lastUpdated: story.lastUpdated,
    });
    return { ctx, cov, covDoc, confidence };
  }, [story, stories, entities, sources, coverage]);

  if (!story || !view) return null;
  const suggestion = view.covDoc?.mergeSuggestion;
  const mergeTarget =
    suggestion?.status === "open"
      ? stories.find((s) => s.id === suggestion.storyId)
      : undefined;

  const acceptMerge = async () => {
    if (!mergeTarget || busy) return;
    setBusy(true);
    try {
      // Ținta (story-ul mai vechi) absoarbe acest story; editorul a decis.
      const merged = mergeStories(mergeTarget, story);
      await saveStory(db, merged);
      await updateDoc(doc(db, "stories", story.id), { status: "archived" });
      await deleteDoc(doc(db, "story_coverage", story.id)).catch(() => {});
      toast.success(`Unit cu „${mergeTarget.title.slice(0, 40)}…"`);
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const dismissMerge = async () => {
    if (!view.covDoc || !suggestion || busy) return;
    setBusy(true);
    try {
      await saveStoryCoverage(db, {
        ...view.covDoc,
        mergeSuggestion: { ...suggestion, status: "dismissed" as const },
      });
      toast.success("Sugestia a fost respinsă — story-urile rămân separate.");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={!!story} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-base">{story.title}</SheetTitle>
          <p className="font-mono text-[11px] text-muted-foreground">
            {story.signalCount} semnale · {view.cov.independentSources} surse ·{" "}
            {CONFIDENCE_LABELS[view.confidence.label]} · {view.confidence.score}
          </p>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-8">
          {mergeTarget && (
            <div className="rounded-lg border border-sky-500/40 bg-sky-500/5 p-3">
              <p className="flex items-center gap-1.5 text-[12px] font-medium text-sky-400">
                <GitMerge className="size-3.5" />
                Sugestie AI: pare același eveniment cu
              </p>
              <p className="mt-1 text-[12.5px]">{mergeTarget.title}</p>
              <p className="mt-1 text-[11.5px] italic text-muted-foreground">
                {suggestion?.reason}
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={acceptMerge} disabled={busy}>
                  <GitMerge className="size-3.5" />
                  Unește story-urile
                </Button>
                <Button size="sm" variant="outline" onClick={dismissMerge} disabled={busy}>
                  <X className="size-3.5" />
                  Păstrează separat
                </Button>
              </div>
            </div>
          )}

          <Section title="Rezumat" icon={Link2}>
            <p className="text-[12.5px] text-muted-foreground">{story.summary}</p>
          </Section>

          <Section title="Entități implicate" icon={Network}>
            {view.ctx.entities.length === 0 ? (
              <p className="text-[11.5px] text-muted-foreground/60">
                Nicio entitate legată încă.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {view.ctx.entities.slice(0, 10).map((e) => (
                  <button key={e.id} onClick={() => onOpenEntity(e)}>
                    <Chip className="transition-colors hover:border-primary hover:text-primary">
                      {e.name} <span className="text-muted-foreground">×{e.mentionCount}</span>
                    </Chip>
                  </button>
                ))}
              </div>
            )}
          </Section>

          <Section title="Fundal istoric (story-uri anterioare)" icon={Clock}>
            <RelatedList
              items={view.ctx.background}
              onOpenStory={onOpenStory}
              empty="Niciun episod anterior cunoscut — subiect nou."
            />
          </Section>

          <Section title="Evoluții în curs" icon={ArrowRight}>
            <RelatedList
              items={view.ctx.ongoing}
              onOpenStory={onOpenStory}
              empty="Nicio evoluție activă înrudită."
            />
          </Section>

          <Section title="Chestiuni nerezolvate (fără update >7 zile)" icon={X}>
            <RelatedList
              items={view.ctx.unresolved}
              onOpenStory={onOpenStory}
              empty="Nimic rămas în aer din subiectele înrudite."
            />
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
