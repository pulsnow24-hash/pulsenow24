/**
 * News Platform Engine — Context Engine.
 *
 * Construiește contextul unui Story sau al unei Entități DIN datele
 * motoarelor existente (Story, Entity, Alerts) — nimic nu se duplică,
 * totul se calculează determinist la citire și e explicabil. AI-ul nu
 * intervine aici; el e folosit doar la verdictele semantice (linking).
 */
import type { Story } from "./story";
import { normalizeAlias, type Entity } from "./entity";
import type { AlertType, MonitorAlert } from "./workspace";

/* ── Memoria unei entități (recurențe) ─────────────────────── */

export interface EntityMemory {
  /** Temele care revin în story-urile entității (din story.entities) */
  recurringTopics: { name: string; count: number }[];
  /** Locurile care revin */
  recurringLocations: { name: string; count: number }[];
  /** Organizațiile/instituțiile care revin */
  recurringOrganizations: { name: string; count: number }[];
  /** Story-urile entității, cele mai recente primele */
  stories: Story[];
}

function countRecurring(lists: string[][]): { name: string; count: number }[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const list of lists) {
    const seen = new Set<string>();
    for (const raw of list) {
      const key = normalizeAlias(raw);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const prev = counts.get(key);
      counts.set(key, { name: prev?.name ?? raw, count: (prev?.count ?? 0) + 1 });
    }
  }
  return [...counts.values()]
    .filter((c) => c.count >= 2)
    .sort((a, b) => b.count - a.count);
}

/** Recurențele entității, calculate din story-urile în care apare. */
export function buildEntityMemory(entity: Entity, allStories: Story[]): EntityMemory {
  const ids = new Set(entity.relatedStoryIds);
  const stories = allStories
    .filter((s) => ids.has(s.id))
    .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
  return {
    recurringTopics: countRecurring(stories.map((s) => s.entities)).slice(0, 6),
    recurringLocations: countRecurring(stories.map((s) => s.locations)).slice(0, 6),
    recurringOrganizations: countRecurring(
      stories.map((s) => s.organizations)
    ).slice(0, 6),
    stories,
  };
}

/* ── Cronologia unei entități ──────────────────────────────── */

export type TimelineKind =
  | "announcement"
  | "incident"
  | "investment"
  | "investigation"
  | "infrastructure"
  | "official"
  | "signal";

export const TIMELINE_KIND_LABELS: Record<TimelineKind, string> = {
  announcement: "Anunț",
  incident: "Incident",
  investment: "Investiție",
  investigation: "Anchetă",
  infrastructure: "Infrastructură",
  official: "Comunicare oficială",
  signal: "Semnal",
};

const ALERT_TO_TIMELINE: Partial<Record<AlertType, TimelineKind>> = {
  "institution-announcement": "announcement",
  emergency: "incident",
  infrastructure: "infrastructure",
  funding: "investment",
  investment: "investment",
  "negative-spike": "investigation",
  "breaking-local": "incident",
};

export interface EntityTimelineEvent {
  at: string;
  title: string;
  source: string;
  kind: TimelineKind;
  storyId?: string;
}

/**
 * Cronologia entității: semnalele story-urilor ei + alertele care o
 * privesc, categorisite determinist (tipul alertei → tipul evenimentului).
 */
export function buildEntityTimeline(
  entity: Entity,
  stories: Story[],
  alerts: MonitorAlert[]
): EntityTimelineEvent[] {
  const storyIds = new Set(entity.relatedStoryIds);
  const related = stories.filter((s) => storyIds.has(s.id));

  // Tipul dominant al fiecărui story, din alertele lui
  const kindByStory = new Map<string, TimelineKind>();
  const aliasKeysSet = new Set(
    [entity.name, ...entity.aliases].map(normalizeAlias)
  );
  const entityAlerts = alerts.filter(
    (a) =>
      (a.storyId && storyIds.has(a.storyId)) ||
      a.institutions.some((n) => aliasKeysSet.has(normalizeAlias(n)))
  );
  for (const a of entityAlerts) {
    const kind = ALERT_TO_TIMELINE[a.type];
    if (kind && a.storyId && !kindByStory.has(a.storyId))
      kindByStory.set(a.storyId, kind);
  }

  const events: EntityTimelineEvent[] = [];
  for (const s of related) {
    // Sursele oficiale (instituții/primării) → comunicare oficială
    for (const e of s.timeline) {
      if (e.type !== "signal") continue;
      events.push({
        at: e.at,
        title: e.title,
        source: e.source ?? "Sursă",
        kind: kindByStory.get(s.id) ?? "signal",
        storyId: s.id,
      });
    }
  }
  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);
}

/* ── Contextul unui Story ──────────────────────────────────── */

export interface RelatedStory {
  story: Story;
  /** Entitățile comune care justifică legătura — explicabil */
  sharedEntities: string[];
  score: number;
}

/**
 * Story-urile înrudite: suprapunerea listelor de entități/persoane/
 * locuri/organizații (normalizate). Scor = numărul de elemente comune,
 * ponderat spre recent.
 */
export function findRelatedStories(
  story: Story,
  allStories: Story[],
  limit = 6
): RelatedStory[] {
  const bag = (s: Story) =>
    new Map(
      [...s.entities, ...s.people, ...s.locations, ...s.organizations]
        .map((x) => [normalizeAlias(x), x] as const)
        .filter(([k]) => !!k)
    );
  const own = bag(story);
  const results: RelatedStory[] = [];
  for (const other of allStories) {
    if (other.id === story.id) continue;
    const theirs = bag(other);
    const shared: string[] = [];
    for (const [k, original] of theirs) if (own.has(k)) shared.push(original);
    if (shared.length === 0) continue;
    results.push({ story: other, sharedEntities: shared, score: shared.length });
  }
  return results
    .sort(
      (a, b) =>
        b.score - a.score || b.story.lastUpdated.localeCompare(a.story.lastUpdated)
    )
    .slice(0, limit);
}

export interface StoryContext {
  related: RelatedStory[];
  /** Story-uri înrudite mai VECHI decât acesta — fundalul istoric */
  background: RelatedStory[];
  /** Înrudite, încă active (developing/breaking) — evoluții în curs */
  ongoing: RelatedStory[];
  /** Înrudite, active dar fără update de >7 zile — chestiuni nerezolvate */
  unresolved: RelatedStory[];
  /** Entitățile story-ului, cu memoria lor (din Entity Engine) */
  entities: Entity[];
  locations: string[];
}

export function buildStoryContext(
  story: Story,
  allStories: Story[],
  allEntities: Entity[],
  now: number = Date.now()
): StoryContext {
  const related = findRelatedStories(story, allStories, 8);
  const createdAt = new Date(story.createdAt).getTime();
  const background = related.filter(
    (r) => new Date(r.story.createdAt).getTime() < createdAt
  );
  const active = related.filter((r) =>
    ["developing", "breaking"].includes(r.story.status)
  );
  const ongoing = active.filter(
    (r) => now - new Date(r.story.lastUpdated).getTime() <= 7 * 86400_000
  );
  const unresolved = active.filter(
    (r) => now - new Date(r.story.lastUpdated).getTime() > 7 * 86400_000
  );
  const entities = allEntities
    .filter((e) => e.relatedStoryIds.includes(story.id))
    .sort((a, b) => b.mentionCount - a.mentionCount);
  return {
    related,
    background,
    ongoing,
    unresolved,
    entities,
    locations: story.locations,
  };
}

/* ── Candidați de unire (linking determinist, verdict AI separat) ── */

export interface MergeCandidate {
  a: Story;
  b: Story;
  sharedEntities: string[];
  /** Suprapunerea token-urilor din titluri (0-1) */
  titleOverlap: number;
}

function titleTokens(title: string): Set<string> {
  return new Set(
    normalizeAlias(title)
      .split(" ")
      .filter((w) => w.length >= 4)
  );
}

/**
 * Perechile de story-uri ACTIVE care ar putea fi același eveniment:
 * ≥2 entități comune SAU suprapunere mare de titlu. AI-ul dă verdictul
 * semantic; editorul decide întotdeauna.
 */
export function findMergeCandidates(stories: Story[]): MergeCandidate[] {
  const active = stories.filter((s) => s.status !== "archived");
  const out: MergeCandidate[] = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const rel = findRelatedStories(active[i], [active[j]], 1)[0];
      const shared = rel?.sharedEntities ?? [];
      const ta = titleTokens(active[i].title);
      const tb = titleTokens(active[j].title);
      const common = [...ta].filter((t) => tb.has(t)).length;
      const overlap = ta.size && tb.size ? common / Math.min(ta.size, tb.size) : 0;
      if (shared.length >= 2 || overlap >= 0.5) {
        out.push({
          a: active[i],
          b: active[j],
          sharedEntities: shared,
          titleOverlap: Math.round(overlap * 100) / 100,
        });
      }
    }
  }
  return out.slice(0, 6);
}
