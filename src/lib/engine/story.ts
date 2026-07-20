/**
 * News Platform Engine — modelul de domeniu Story.
 *
 * Obiectul central al platformei: un Story este EVENIMENTUL real din lume;
 * semnalele (știri din surse) și articolele (output editorial) se atașează
 * de el. Logica de aici e pură (fără I/O) și reutilizabilă de orice
 * publicație construită pe engine.
 */

export type StoryStatus = "developing" | "breaking" | "confirmed" | "archived";

export type StoryEventType = "signal" | "article" | "status" | "created";

export interface StoryTimelineEvent {
  at: string;
  type: StoryEventType;
  title: string;
  /** Numele sursei (pentru semnale) */
  source?: string;
  /** Id-ul obiectului legat: inbox item / articol */
  refId?: string;
}

export interface Story {
  id: string;
  title: string;
  status: StoryStatus;
  /** Rezumat AI al evenimentului (setat la creare) */
  summary: string;
  categorie: string;
  timeline: StoryTimelineEvent[];
  /** Articolele publicate/draft care aparțin acestui story */
  articleIds: string[];
  /** Numele surselor care au relatat (unice) */
  sources: string[];
  /** Câte semnale (știri-sursă) s-au atașat în total */
  signalCount: number;
  /** Entități generice / teme */
  entities: string[];
  people: string[];
  locations: string[];
  organizations: string[];
  /** Scoruri agregate 0-100 */
  trustScore: number;
  importanceScore: number;
  breakingScore: number;
  /** 0 = global … 100 = strict local (RO) */
  localityScore: number;
  countryCode: string;
  coverImage?: string;
  createdAt: string;
  lastUpdated: string;
}

/** Semnalul minim necesar pentru a actualiza un Story (dintr-un item de inbox). */
export interface StorySignal {
  refId: string;
  titlu: string;
  sursa: string;
  publicatLa: string;
  importanceScore: number;
  trustScore: number;
  countryCode: string;
}

/** Definiția unui story nou, propusă de AI la asignare. */
export interface NewStoryDefinition {
  title: string;
  summary: string;
  entities: string[];
  people: string[];
  locations: string[];
  organizations: string[];
}

const MAX_TIMELINE = 60;

function uniq(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.trim()).filter(Boolean))];
}

export function slugifyStoryId(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  // Sufix scurt pentru unicitate fără coliziuni între evenimente similare
  return `${slug || "story"}-${Date.now().toString(36)}`;
}

/** Creează un Story nou dintr-o definiție AI + primul semnal. */
export function createStory(
  def: NewStoryDefinition,
  categorie: string,
  countryCode: string
): Omit<Story, "id"> {
  const now = new Date().toISOString();
  return {
    title: def.title,
    status: "developing",
    summary: def.summary,
    categorie,
    timeline: [{ at: now, type: "created", title: "Story creat" }],
    articleIds: [],
    sources: [],
    signalCount: 0,
    entities: uniq(def.entities),
    people: uniq(def.people),
    locations: uniq(def.locations),
    organizations: uniq(def.organizations),
    trustScore: 0,
    importanceScore: 0,
    breakingScore: 0,
    localityScore: countryCode === "RO" ? 80 : countryCode === "XX" ? 10 : 30,
    countryCode,
    createdAt: now,
    lastUpdated: now,
  };
}

/** Numărul de surse independente care au relatat evenimentul. */
export function corroboration(story: Pick<Story, "sources">): number {
  return story.sources.length;
}

/**
 * Încrederea în story: trust agregat ponderat cu coroborarea.
 * O singură sursă nu poate depăși ~65, indiferent cât de bună e.
 */
export function storyConfidence(
  story: Pick<Story, "trustScore" | "sources">
): number {
  const corr = Math.min(5, story.sources.length);
  const corrFactor = 0.5 + corr * 0.1; // 1 sursă → 0.6, 5+ → 1.0
  return Math.round(Math.min(100, story.trustScore * corrFactor));
}

/** Derivă statusul din scoruri (nu retrogradează un story confirmat). */
export function deriveStatus(story: Story): StoryStatus {
  if (story.status === "archived") return "archived";
  if (story.breakingScore >= 80) return "breaking";
  if (corroboration(story) >= 3 && storyConfidence(story) >= 70) {
    return "confirmed";
  }
  if (story.status === "confirmed") return "confirmed";
  return "developing";
}

/**
 * Aplică un semnal nou peste un Story existent și întoarce obiectul
 * actualizat (pur — fără I/O). Recalculează scorurile agregate.
 */
export function applySignal(story: Story, signal: StorySignal): Story {
  const now = new Date().toISOString();
  const sources = uniq([...story.sources, signal.sursa]);
  const signalCount = story.signalCount + 1;

  // Importanța: maximul semnalelor, cu un mic bonus de coroborare
  const importanceScore = Math.min(
    100,
    Math.max(story.importanceScore, signal.importanceScore) +
      Math.min(10, (sources.length - 1) * 2)
  );

  // Trust: medie mobilă a trust-ului semnalelor + bonus de coroborare
  const prevTrust = story.trustScore || signal.trustScore;
  const blended = Math.round(prevTrust * 0.7 + signal.trustScore * 0.3);
  const trustScore = Math.min(100, blended + Math.min(15, (sources.length - 1) * 3));

  // Breaking: importanță mare + velocitate (semnale în ultimele 3 ore)
  const threeHoursAgo = Date.now() - 3 * 3600_000;
  const recentSignals =
    story.timeline.filter(
      (e) => e.type === "signal" && new Date(e.at).getTime() >= threeHoursAgo
    ).length + 1;
  const breakingScore = Math.min(
    100,
    Math.round(importanceScore * 0.6 + Math.min(4, recentSignals) * 10)
  );

  // Localitate: se apropie de profilul semnalelor primite
  const signalLocality =
    signal.countryCode === "RO" ? 80 : signal.countryCode === "XX" ? 10 : 30;
  const localityScore = Math.round(
    story.localityScore * 0.7 + signalLocality * 0.3
  );

  const timeline: StoryTimelineEvent[] = [
    ...story.timeline,
    {
      at: signal.publicatLa || now,
      type: "signal" as const,
      title: signal.titlu,
      source: signal.sursa,
      refId: signal.refId,
    },
  ].slice(-MAX_TIMELINE);

  const next: Story = {
    ...story,
    sources,
    signalCount,
    importanceScore,
    trustScore,
    breakingScore,
    localityScore,
    timeline,
    lastUpdated: now,
  };
  next.status = deriveStatus(next);
  return next;
}

/** Leagă un articol de story (pur): id, timeline, eventual cover. */
export function attachArticle(
  story: Story,
  article: { id: string; titlu: string; imagine?: string }
): Story {
  if (story.articleIds.includes(article.id)) {
    return { ...story, lastUpdated: new Date().toISOString() };
  }
  const now = new Date().toISOString();
  return {
    ...story,
    articleIds: [...story.articleIds, article.id],
    coverImage: story.coverImage || article.imagine || undefined,
    timeline: [
      ...story.timeline,
      { at: now, type: "article" as const, title: article.titlu, refId: article.id },
    ].slice(-MAX_TIMELINE),
    lastUpdated: now,
  };
}

export function storyStatusMeta(status: StoryStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case "breaking":
      return { label: "Breaking", className: "text-red-500 bg-red-500/10 border-red-500/30" };
    case "confirmed":
      return { label: "Confirmat", className: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
    case "archived":
      return { label: "Arhivat", className: "text-zinc-400 bg-zinc-500/10 border-zinc-500/30" };
    default:
      return { label: "În desfășurare", className: "text-amber-400 bg-amber-500/10 border-amber-500/30" };
  }
}

/**
 * Unește două story-uri despre ACELAȘI eveniment (pur — fără I/O).
 * Ținta absoarbe sursele, semnalele, articolele și entitățile celuilalt;
 * scorurile agregate iau maximul (dovezile se adună, nu se pierd).
 * Folosit DOAR la decizia explicită a editorului.
 */
export function mergeStories(target: Story, other: Story): Story {
  const timeline: StoryTimelineEvent[] = [
    ...target.timeline,
    ...other.timeline.filter(
      (e) =>
        e.type === "signal" &&
        !target.timeline.some(
          (t) => t.type === "signal" && t.title === e.title && t.at === e.at
        )
    ),
    {
      at: new Date().toISOString(),
      type: "status" as const,
      title: `Story unit cu „${other.title}"`,
    },
  ]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-MAX_TIMELINE);

  const merged: Story = {
    ...target,
    sources: uniq([...target.sources, ...other.sources]),
    signalCount: target.signalCount + other.signalCount,
    articleIds: uniq([...target.articleIds, ...other.articleIds]),
    entities: uniq([...target.entities, ...other.entities]),
    people: uniq([...target.people, ...other.people]),
    locations: uniq([...target.locations, ...other.locations]),
    organizations: uniq([...target.organizations, ...other.organizations]),
    trustScore: Math.max(target.trustScore, other.trustScore),
    importanceScore: Math.max(target.importanceScore, other.importanceScore),
    breakingScore: Math.max(target.breakingScore, other.breakingScore),
    localityScore: Math.max(target.localityScore, other.localityScore),
    createdAt:
      target.createdAt < other.createdAt ? target.createdAt : other.createdAt,
    timeline,
    lastUpdated: new Date().toISOString(),
  };
  merged.status = deriveStatus(merged);
  return merged;
}
