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
