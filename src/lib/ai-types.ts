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
}

export interface SocialPosts {
  facebook: string;
  instagram: string;
  x: string;
  linkedin: string;
  tiktok: string;
}

/** Element din inbox: știre din RSS, evaluată de AI */
export interface InboxScoredItem {
  titlu: string;
  link: string;
  sursa: string;
  descriere: string;
  publicatLa: string;
  scor: number;
  categorie: string;
  motiv: string;
  retine: boolean;
}
