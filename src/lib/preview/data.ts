/**
 * Strat de date pentru PREVIEW-ul public (redesign, 3 direcții).
 *
 * Folosește DOAR date reale de producție, publice: Story-uri și entități
 * (ambele lizibile public prin reguli). NU atinge story_coverage, alerts,
 * workflow, briefs sau vreo inteligență internă. Confidence-ul public e
 * derivat exclusiv din câmpurile publice ale Story-ului (încrederea agregată
 * a surselor + coroborare + prospețime) — nimic inventat.
 */
import { getStories } from "@/lib/stories";
import { getTrendingEntities, getTopEntities } from "@/lib/entities";
import type { Story } from "@/lib/engine/story";
import type { Entity } from "@/lib/engine/entity";
import { matchKeywords, DEFAULT_KEYWORDS } from "@/lib/engine/workspace";

export type ConfidenceLabel = "high" | "medium" | "low";

export interface PreviewStory {
  id: string;
  title: string;
  summary: string;
  category: string;
  status: Story["status"];
  breaking: boolean;
  sources: string[];
  sourceCount: number;
  /** 0-100, derivat din câmpuri publice (trust surse + coroborare + prospețime) */
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  updated: string;
  updatedLabel: string;
  timeline: { at: string; title: string; source?: string }[];
  entities: string[];
  readingMins: number;
  isLocal: boolean;
}

export const CONFIDENCE_LABEL_RO: Record<ConfidenceLabel, string> = {
  high: "Încredere ridicată",
  medium: "Încredere medie",
  low: "Încredere în verificare",
};

export const CATEGORY_RO: Record<string, string> = {
  Actualitate: "Actualitate",
  Geopolitică: "Geopolitică",
  Politică: "Politică",
  Business: "Business",
  "AI & Tech": "AI & Tech",
  Monden: "Monden",
  Viral: "Viral",
};

/** Confidence public (0-100) din semnale reale ale Story-ului. */
export function publicConfidence(story: Story): {
  score: number;
  label: ConfidenceLabel;
} {
  const base = story.trustScore || 60;
  const corroboration = Math.min(18, Math.max(0, story.sources.length - 1) * 6);
  const ageMs = Date.now() - new Date(story.lastUpdated).getTime();
  const freshness = isNaN(ageMs)
    ? 0
    : ageMs < 24 * 3600_000
      ? 4
      : ageMs < 72 * 3600_000
        ? 2
        : ageMs > 7 * 24 * 3600_000
          ? -6
          : 0;
  const score = Math.max(0, Math.min(100, Math.round(base + corroboration + freshness)));
  const label: ConfidenceLabel = score >= 75 ? "high" : score >= 50 ? "medium" : "low";
  return { score, label };
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff)) return "";
  const min = Math.round(diff / 60000);
  if (min < 1) return "chiar acum";
  if (min < 60) return `acum ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `acum ${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `acum ${d} ${d === 1 ? "zi" : "zile"}`;
  return new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "short" });
}

function readingMins(summary: string): number {
  const words = summary.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 60));
}

function toPreview(s: Story): PreviewStory {
  const { score, label } = publicConfidence(s);
  const entities = [
    ...new Set([...s.entities, ...s.people, ...s.locations, ...s.organizations]),
  ].filter(Boolean);
  const isLocal =
    matchKeywords(
      [s.title, s.summary, ...entities].join(" "),
      DEFAULT_KEYWORDS
    ).length > 0;
  return {
    id: s.id,
    title: s.title,
    summary: s.summary,
    category: s.categorie,
    status: s.status,
    breaking: s.breakingScore >= 65 || s.status === "breaking",
    sources: [...new Set(s.sources)],
    sourceCount: new Set(s.sources).size,
    confidence: score,
    confidenceLabel: label,
    updated: s.lastUpdated,
    updatedLabel: relTime(s.lastUpdated),
    timeline: (s.timeline ?? [])
      .filter((e) => e.type === "signal" || e.type === "created")
      .slice(-6)
      .map((e) => ({ at: e.at, title: e.title, source: e.source })),
    entities: entities.slice(0, 8),
    readingMins: readingMins(s.summary),
    isLocal,
  };
}

/** Convertește Story-uri reale în forma de preview (pentru înrudiri). */
export function toPreviewList(stories: Story[]): PreviewStory[] {
  return stories.filter((s) => s.status !== "archived").map(toPreview);
}

export interface PreviewData {
  hero: PreviewStory;
  live: PreviewStory[];
  top: PreviewStory[];
  explain: PreviewStory[];
  timelineStory: PreviewStory;
  trending: { name: string; type: Entity["type"]; mentionCount: number; trendScore: number }[];
  valcea: PreviewStory[];
  storyPage: PreviewStory;
  total: number;
}

/** Colectează tot ce afișează cele 3 direcții — din date reale, o singură dată. */
export async function getPreviewData(): Promise<PreviewData | null> {
  const stories = await getStories({ limit: 60 });
  if (stories.length === 0) return null;

  const previews = stories.map(toPreview);
  // Sortăm după un scor editorial: importanță (trust) + coroborare + velocitate
  const rank = (p: PreviewStory) =>
    p.confidence + p.sourceCount * 8 + (p.breaking ? 20 : 0);
  const byRank = [...previews].sort((a, b) => rank(b) - rank(a));

  const hero = byRank[0];
  const used = new Set([hero.id]);
  const take = (arr: PreviewStory[], n: number) => {
    const out: PreviewStory[] = [];
    for (const p of arr) {
      if (used.has(p.id)) continue;
      used.add(p.id);
      out.push(p);
      if (out.length >= n) break;
    }
    return out;
  };

  const live = take(
    [...previews].sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime()),
    4
  );
  const top = take(byRank, 6);
  // „De ce contează": story-uri cu rezumat consistent (explicație reală)
  const explain = take(
    [...previews].filter((p) => p.summary.length > 90).sort((a, b) => b.confidence - a.confidence),
    3
  );
  // Cronologie: story-ul cu cel mai bogat timeline real
  const timelineStory =
    [...previews].sort((a, b) => b.timeline.length - a.timeline.length)[0] ?? hero;
  // Pagina de story: subiect real cu timeline + surse + entități bogate
  const storyPage =
    [...previews]
      .filter((p) => p.timeline.length >= 3 && p.entities.length >= 2)
      .sort((a, b) => b.sourceCount - a.sourceCount || b.confidence - a.confidence)[0] ??
    timelineStory;

  const valcea = previews
    .filter((p) => p.isLocal)
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, 4);

  const trendingEntities = await getTrendingEntities(12).catch(() => []);
  const topEntities =
    trendingEntities.length >= 6
      ? trendingEntities
      : await getTopEntities({ limit: 12 }).catch(() => []);
  const trending = topEntities
    .filter((e) => e.mentionCount > 0)
    .slice(0, 10)
    .map((e) => ({
      name: e.name,
      type: e.type,
      mentionCount: e.mentionCount,
      trendScore: e.trendScore,
    }));

  return {
    hero,
    live,
    top,
    explain,
    timelineStory,
    trending,
    valcea,
    storyPage,
    total: previews.length,
  };
}

/** Story-uri înrudite (shared entities) — pentru pagina de story, date reale. */
export function relatedTo(target: PreviewStory, all: PreviewStory[], limit = 4): PreviewStory[] {
  const keys = new Set(target.entities.map((e) => e.toLowerCase()));
  return all
    .filter((p) => p.id !== target.id)
    .map((p) => ({
      p,
      shared: p.entities.filter((e) => keys.has(e.toLowerCase())).length,
    }))
    .filter((x) => x.shared > 0)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, limit)
    .map((x) => x.p);
}
