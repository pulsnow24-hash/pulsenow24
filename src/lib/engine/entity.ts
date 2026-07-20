/**
 * News Platform Engine — modelul de domeniu Entity.
 *
 * O entitate este un nod reutilizabil de cunoaștere (persoană, instituție,
 * loc, lege…) la care se leagă Story-uri și articole PRIN ID, fără a duplica
 * datele. Logica de aici e pură (fără I/O).
 */

export type EntityType =
  | "person"
  | "organization"
  | "institution"
  | "company"
  | "party"
  | "country"
  | "county"
  | "city"
  | "location"
  | "product"
  | "crypto"
  | "law"
  | "event";

export const ENTITY_TYPES: EntityType[] = [
  "person",
  "organization",
  "institution",
  "company",
  "party",
  "country",
  "county",
  "city",
  "location",
  "product",
  "crypto",
  "law",
  "event",
];

export interface Entity {
  id: string;
  /** Numele canonic afișat */
  name: string;
  type: EntityType;
  /** Variante normalizate (prin normalizeAlias) care indică aceeași entitate */
  aliases: string[];
  firstSeen: string;
  lastSeen: string;
  mentionCount: number;
  relatedStoryIds: string[];
  relatedArticleIds: string[];
  relatedEntityIds: string[];
  /** 0-100 — creșterea recentă a mențiunilor */
  trendScore: number;
  /** 0-100 — importanța agregată a poveștilor în care apare */
  importanceScore: number;
  /** Mențiuni pe zi (yyyy-mm-dd), păstrate ultimele ~14 zile, pentru trend */
  dailyMentions: Record<string, number>;
  /** Memorie pe termen lung: mențiuni pe lună (yyyy-mm), ultimele 24 luni */
  monthlyMentions?: Record<string, number>;
  /** Graful de relații ponderat: entityId → forța legăturii (cu dovezi) */
  relations?: Record<string, EntityRelation>;
}

/**
 * O relație între două entități, construită DIN DOVEZI: fiecare co-apariție
 * într-un semnal o întărește; trecerea timpului o slăbește (decay).
 * Explicabil: weight = f(count, recență), nimic ascuns.
 */
export interface EntityRelation {
  /** Câte semnale au menționat entitățile împreună */
  count: number;
  /** 0-100 — forța curentă (întărită de dovezi, slăbită de timp) */
  weight: number;
  firstSeen: string;
  lastSeen: string;
}

/** Candidat de entitate extras de AI dintr-un semnal. */
export interface ExtractedEntity {
  name: string;
  type: EntityType;
  aliases: string[];
}

const MAX_RELATED = 200;
const MAX_ALIASES = 20;
const TREND_WINDOW_DAYS = 14;
const MAX_MONTHS = 24;
const MAX_RELATIONS = 40;
/** Timp de înjumătățire al forței unei relații fără dovezi noi (zile) */
const RELATION_HALF_LIFE_DAYS = 45;

/** Normalizează un nume pentru potrivire: minuscule, fără diacritice/punctuație. */
export function normalizeAlias(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tabel de aliasuri canonice pentru variantele frecvente RO/EN.
 * Cheia = numele canonic; valorile = variante care se unifică în el.
 * AI-ul furnizează aliasuri suplimentare la extracție.
 */
export const ALIAS_SEED: Record<string, { type: EntityType; aliases: string[] }> = {
  SUA: { type: "country", aliases: ["Statele Unite", "Statele Unite ale Americii", "United States", "USA", "America"] },
  "Uniunea Europeană": { type: "organization", aliases: ["UE", "EU", "European Union"] },
  România: { type: "country", aliases: ["Romania", "RO"] },
  "Marea Britanie": { type: "country", aliases: ["Regatul Unit", "UK", "United Kingdom", "Anglia"] },
  București: { type: "city", aliases: ["Bucharest", "Capitala"] },
  "Vâlcea": { type: "county", aliases: ["județul Vâlcea", "Valcea"] },
  "Consiliul Județean Vâlcea": { type: "institution", aliases: ["CJ Vâlcea", "Consiliul Judetean Valcea"] },
  "Râmnicu Vâlcea": { type: "city", aliases: ["Ramnicu Valcea", "Rm. Vâlcea", "Rm Valcea"] },
  BNR: { type: "institution", aliases: ["Banca Națională a României", "Banca Nationala", "banca centrală"] },
  "Guvernul României": { type: "institution", aliases: ["Guvernul", "Executivul", "Palatul Victoria"] },
  "Parlamentul României": { type: "institution", aliases: ["Parlamentul", "Legislativul"] },
  NATO: { type: "organization", aliases: ["Alianța Nord-Atlantică", "North Atlantic Treaty Organization"] },
  ONU: { type: "organization", aliases: ["Națiunile Unite", "United Nations", "UN"] },
  PSD: { type: "party", aliases: ["Partidul Social Democrat"] },
  PNL: { type: "party", aliases: ["Partidul Național Liberal"] },
  USR: { type: "party", aliases: ["Uniunea Salvați România"] },
  AUR: { type: "party", aliases: ["Alianța pentru Unirea Românilor"] },
  Bitcoin: { type: "crypto", aliases: ["BTC"] },
  Ethereum: { type: "crypto", aliases: ["ETH"] },
};

/** Index inversat al seed-ului: alias normalizat → nume canonic. */
const SEED_INDEX: Map<string, string> = (() => {
  const idx = new Map<string, string>();
  for (const [canonical, def] of Object.entries(ALIAS_SEED)) {
    idx.set(normalizeAlias(canonical), canonical);
    for (const a of def.aliases) idx.set(normalizeAlias(a), canonical);
  }
  return idx;
})();

/** Aplică tabelul canonic: „Statele Unite" → „SUA" (nume + tip + aliasuri seed). */
export function canonicalize(candidate: ExtractedEntity): ExtractedEntity {
  const canonical = SEED_INDEX.get(normalizeAlias(candidate.name));
  if (!canonical) return candidate;
  const seed = ALIAS_SEED[canonical];
  return {
    name: canonical,
    type: seed.type,
    aliases: [...new Set([...seed.aliases, candidate.name, ...candidate.aliases])],
  };
}

export function entityId(name: string, type: EntityType): string {
  const slug = normalizeAlias(name).replace(/ /g, "-").slice(0, 48) || "entitate";
  return `${type}-${slug}`;
}

/** Setul de chei de potrivire (aliasuri normalizate) al unei entități. */
export function aliasKeys(e: Pick<Entity, "name" | "aliases">): string[] {
  return [...new Set([normalizeAlias(e.name), ...e.aliases.map(normalizeAlias)])].filter(Boolean);
}

/**
 * Găsește entitatea existentă care se potrivește cu un candidat:
 * același tip + cel puțin un alias normalizat comun.
 */
export function matchEntity(
  candidate: ExtractedEntity,
  existing: Entity[]
): Entity | undefined {
  const keys = new Set(aliasKeys({ name: candidate.name, aliases: candidate.aliases }));
  return existing.find(
    (e) => e.type === candidate.type && aliasKeys(e).some((k) => keys.has(k))
  );
}

export function createEntity(candidate: ExtractedEntity): Entity {
  const now = new Date().toISOString();
  return {
    id: entityId(candidate.name, candidate.type),
    name: candidate.name,
    type: candidate.type,
    aliases: [...new Set(candidate.aliases.map(normalizeAlias))]
      .filter((a) => a && a !== normalizeAlias(candidate.name))
      .slice(0, MAX_ALIASES),
    firstSeen: now,
    lastSeen: now,
    mentionCount: 0,
    relatedStoryIds: [],
    relatedArticleIds: [],
    relatedEntityIds: [],
    trendScore: 0,
    importanceScore: 0,
    dailyMentions: {},
  };
}

function pruneDaily(daily: Record<string, number>): Record<string, number> {
  const cutoff = new Date(Date.now() - TREND_WINDOW_DAYS * 86400_000)
    .toISOString()
    .slice(0, 10);
  const out: Record<string, number> = {};
  for (const [day, n] of Object.entries(daily)) if (day >= cutoff) out[day] = n;
  return out;
}

/**
 * Trend 0-100: mențiunile din ultimele 3 zile față de media celor 7 zile
 * anterioare. 50 = ritm constant; >50 = în creștere.
 */
export function computeTrendScore(daily: Record<string, number>): number {
  const dayKey = (offset: number) =>
    new Date(Date.now() - offset * 86400_000).toISOString().slice(0, 10);
  let recent = 0;
  for (let i = 0; i < 3; i++) recent += daily[dayKey(i)] ?? 0;
  let prev = 0;
  for (let i = 3; i < 10; i++) prev += daily[dayKey(i)] ?? 0;
  const prevAvg3 = (prev / 7) * 3;
  if (recent === 0) return 0;
  if (prevAvg3 === 0) return Math.min(100, 60 + recent * 8);
  return Math.max(0, Math.min(100, Math.round(50 + 50 * ((recent - prevAvg3) / (recent + prevAvg3)))));
}

export interface MentionContext {
  storyId?: string;
  articleId?: string;
  importance: number;
  /** Id-urile celorlalte entități menționate în același semnal */
  coEntityIds: string[];
  /** Aliasuri noi descoperite la această mențiune */
  newAliases?: string[];
}

/** Aplică o mențiune peste o entitate (pur) — actualizează toate agregatele. */
export function applyMention(entity: Entity, ctx: MentionContext): Entity {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const daily = pruneDaily({ ...entity.dailyMentions });
  daily[today] = (daily[today] ?? 0) + 1;

  const aliases = [
    ...new Set([
      ...entity.aliases,
      ...(ctx.newAliases ?? []).map(normalizeAlias),
    ]),
  ]
    .filter((a) => a && a !== normalizeAlias(entity.name))
    .slice(0, MAX_ALIASES);

  const union = (arr: string[], v?: string) =>
    v && !arr.includes(v) ? [...arr, v].slice(-MAX_RELATED) : arr;

  let relatedEntityIds = entity.relatedEntityIds;
  for (const id of ctx.coEntityIds) {
    if (id !== entity.id) relatedEntityIds = union(relatedEntityIds, id);
  }

  // Memorie lunară (ultimele 24 de luni)
  const month = now.slice(0, 7);
  const monthly: Record<string, number> = { ...(entity.monthlyMentions ?? {}) };
  monthly[month] = (monthly[month] ?? 0) + 1;
  const monthKeys = Object.keys(monthly).sort();
  for (const k of monthKeys.slice(0, Math.max(0, monthKeys.length - MAX_MONTHS)))
    delete monthly[k];

  // Graful de relații: dovezile întăresc, timpul slăbește
  const relations: Record<string, EntityRelation> = {
    ...(entity.relations ?? {}),
  };
  for (const id of ctx.coEntityIds) {
    if (id === entity.id) continue;
    const prev = relations[id];
    const decayed = prev ? decayRelationWeight(prev, now) : 0;
    relations[id] = {
      count: (prev?.count ?? 0) + 1,
      // +18 per dovadă nouă peste forța rămasă, plafonat la 100
      weight: Math.min(100, Math.round(decayed + 18)),
      firstSeen: prev?.firstSeen ?? now,
      lastSeen: now,
    };
  }
  // Păstrăm doar cele mai puternice MAX_RELATIONS legături
  const ids = Object.keys(relations);
  if (ids.length > MAX_RELATIONS) {
    const keep = new Set(
      ids
        .sort((a, b) => relations[b].weight - relations[a].weight)
        .slice(0, MAX_RELATIONS)
    );
    for (const id of ids) if (!keep.has(id)) delete relations[id];
  }

  return {
    ...entity,
    aliases,
    lastSeen: now,
    mentionCount: entity.mentionCount + 1,
    dailyMentions: daily,
    monthlyMentions: monthly,
    relations,
    trendScore: computeTrendScore(daily),
    importanceScore: Math.round(
      entity.importanceScore === 0
        ? ctx.importance
        : entity.importanceScore * 0.8 + ctx.importance * 0.2
    ),
    relatedStoryIds: union(entity.relatedStoryIds, ctx.storyId),
    relatedArticleIds: union(entity.relatedArticleIds, ctx.articleId),
    relatedEntityIds,
  };
}

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  person: "Persoană",
  organization: "Organizație",
  institution: "Instituție",
  company: "Companie",
  party: "Partid",
  country: "Țară",
  county: "Județ",
  city: "Oraș",
  location: "Loc",
  product: "Produs",
  crypto: "Crypto",
  law: "Lege",
  event: "Eveniment",
};

/** Forța unei relații după trecerea timpului (înjumătățire la 45 de zile). */
export function decayRelationWeight(rel: EntityRelation, nowIso: string): number {
  const days =
    (new Date(nowIso).getTime() - new Date(rel.lastSeen).getTime()) / 86400_000;
  if (!isFinite(days) || days <= 0) return rel.weight;
  return rel.weight * Math.pow(0.5, days / RELATION_HALF_LIFE_DAYS);
}

/** Eticheta tipată a unei relații, derivată determinist din tipuri. */
export function relationKindLabel(a: EntityType, b: EntityType): string {
  const la = ENTITY_TYPE_LABELS[a] ?? a;
  const lb = ENTITY_TYPE_LABELS[b] ?? b;
  return `${la} ↔ ${lb}`;
}

/** Relațiile curente ale unei entități, cu decay aplicat, cele mai puternice primele. */
export function currentRelations(
  entity: Entity,
  nowIso: string
): { entityId: string; count: number; weight: number; firstSeen: string; lastSeen: string }[] {
  return Object.entries(entity.relations ?? {})
    .map(([entityId, rel]) => ({
      entityId,
      count: rel.count,
      weight: Math.round(decayRelationWeight(rel, nowIso)),
      firstSeen: rel.firstSeen,
      lastSeen: rel.lastSeen,
    }))
    .filter((r) => r.weight > 0)
    .sort((a, b) => b.weight - a.weight);
}
