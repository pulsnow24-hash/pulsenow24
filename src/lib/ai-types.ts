/**
 * Tipuri partajate între rutele API (server) și panoul de administrare (client)
 * pentru funcțiile AI: generare articol, postări sociale, inbox de știri.
 */
import type { QAPair } from "./articles";

/** Articolul complet generat de AI din URL sau text lipit */
export interface GeneratedArticle {
  titlu: string;
  sumar: string;
  categorie: string;
  breaking: boolean;
  fapt: string;
  deCeConteaza: string;
  unghi: string;
  opinie: string;
  predictie: string;
  dezbatere: string;
  qa: QAPair[];
  taguri: string[];
  seoTitle: string;
  metaDescription: string;
  keywords: string[];
  imagineSugestie: string;
  sursaNume: string;
  autor: string;
  /** og:image extras din pagina-sursă (completat de server, nu de model) */
  imagineUrl?: string;
}

export interface SocialPosts {
  facebook: string;
  instagram: string;
  x: string;
  linkedin: string;
  tiktok: string;
}

export type InboxPriority = "breaking" | "high" | "normal" | "low";

/** Element din inbox: știre din RSS, evaluată multi-dimensional de AI */
export interface InboxScoredItem {
  titlu: string;
  link: string;
  sursa: string;
  descriere: string;
  publicatLa: string;
  /** Scoruri AI, 0-100 */
  importanceScore: number;
  trustScore: number;
  viralScore: number;
  seoScore: number;
  /** Risc de fake news, 0-100 (mai mare = mai riscant) */
  fakeNewsRisk: number;
  categorie: string;
  /** Cod ISO 3166-1 alpha-2, sau "EU" / "XX" (global) */
  countryCode: string;
  priority: InboxPriority;
  /** Timp estimat de citire, în minute */
  readingTime: number;
  /** True dacă e o dublură a altei știri din același lot */
  isDuplicate: boolean;
  /** True = merită păstrată în inbox */
  keep: boolean;
  reason: string;
}

export type FactCheckVerdict =
  | "credibil"
  | "partial"
  | "indoielnic"
  | "neverificabil";

export interface FactCheckResult {
  verdict: FactCheckVerdict;
  confidence: number;
  summary: string;
  redFlags: string[];
  claims: { claim: string; assessment: string }[];
}

/* ── AI Copilot (Studio) ──────────────────────────────────── */

/** Contextul articolului trimis copilotului — doar text, fără metadate interne. */
export interface CopilotArticleContext {
  titlu: string;
  sumar: string;
  fapt: string;
  deCeConteaza: string;
  unghi: string;
  opinie: string;
  predictie: string;
  dezbatere: string;
  categorie: string;
  taguri: string;
  keywords: string;
  sursaNume: string;
  sursaUrl: string;
}

export interface CopilotRequest {
  action: string;
  article: CopilotArticleContext;
  /** Blocul-țintă pentru acțiunile aplicate pe un singur câmp */
  target?: { field: string; label: string; text: string; hint?: string };
}

export type CopilotResult =
  | { kind: "text"; text: string }
  | { kind: "options"; options: string[] }
  | { kind: "list"; items: string[] }
  | { kind: "qa"; qa: QAPair[] };

/* ── Story Engine: asignarea semnalelor la povești ────────── */

/** Candidat de story existent, trimis modelului pentru potrivire. */
export interface StoryCandidate {
  id: string;
  title: string;
  summary: string;
  entities: string[];
}

/** Item de asignat (subsetul relevant dintr-un InboxScoredItem). */
export interface AssignableItem {
  titlu: string;
  descriere: string;
  sursa: string;
  categorie: string;
  countryCode: string;
}

/** Definiția unui story nou, propusă de model. */
export interface ProposedStory {
  ref: string;
  title: string;
  summary: string;
  entities: string[];
  people: string[];
  locations: string[];
  organizations: string[];
}

export interface StoryAssignmentResult {
  /** index → id de story existent SAU ref "NEW::n" */
  assignments: { index: number; storyRef: string }[];
  newStories: ProposedStory[];
}

/* ── Entity Intelligence: extracția entităților din semnale ── */

export interface ExtractedEntityRaw {
  name: string;
  type: string;
  aliases: string[];
}

export interface EntityExtractionResult {
  items: { index: number; entities: ExtractedEntityRaw[] }[];
}

/* ── Monitor local: analiza de relevanță a semnalelor ──────── */

export interface LocalAnalysisRaw {
  index: number;
  relevance: number;
  institutionScore: number;
  publicInterest: number;
  urgency: "low" | "medium" | "high" | "critical";
  priority: number;
  commScore: number;
  suggestion: string;
  institutions: string[];
  alertType: string;
}

export interface LocalAnalysisResult {
  items: LocalAnalysisRaw[];
}

/* ── Monitor local: verificarea contradicțiilor între surse ── */

export interface StoryConflictRaw {
  index: number;
  conflicting: boolean;
  note: string;
}

export interface StoryConflictResult {
  items: StoryConflictRaw[];
}

/* ── Monitor local: analiza bogată de consistență ──────────── */

export interface ConsistencyRaw {
  index: number;
  verdict: "consistent" | "complementary" | "update" | "contradiction";
  note: string;
}

export interface ConsistencyResult {
  items: ConsistencyRaw[];
}
