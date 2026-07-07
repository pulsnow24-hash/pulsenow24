/**
 * Stratul de date PulsNow24.
 *
 * Articolele sunt citite din Firestore (colecția "articles", tickerul din
 * config/ticker). Dacă Firestore nu e configurat sau nu răspunde, site-ul
 * folosește articolele demonstrative din demo-articles.ts, ca să nu pice
 * niciodată.
 */
import { collection, doc, getDoc, getDocs } from "firebase/firestore/lite";
import { getDb } from "./firebase";

export type ArticleBadge = "breaking" | "blue" | "buzz";

export interface QAPair {
  q: string;
  a: string;
}

export interface ArticleSEO {
  title?: string;
  metaDescription?: string;
  keywords?: string[];
  canonical?: string;
}

export interface ArticleSource {
  nume?: string;
  url?: string;
  autor?: string;
}

export interface ArticleSocial {
  facebook?: string;
  instagram?: string;
  x?: string;
  linkedin?: string;
  tiktok?: string;
}

export interface Article {
  id: string;
  /** Data publicării în format ISO — folosită la sortare */
  publicatLa: string;
  categorie: string;
  badge: ArticleBadge;
  buzz: boolean;
  titlu: string;
  sumar: string;
  /** Data afișată cititorului, ex. "24 iunie 2026, 13:42" */
  data: string;
  citire: string;
  fapt: string;
  unghi: string;
  opinie: string;
  predictie: string;
  qa: QAPair[];
  dezbatere: string;
  /** "draft" = vizibil doar în admin; lipsă sau "publicat" = live pe site */
  status?: "draft" | "publicat";
  seo?: ArticleSEO;
  sursa?: ArticleSource;
  taguri?: string[];
  social?: ArticleSocial;
  imagineSugestie?: string;
  /** URL-ul imaginii principale (Firebase Storage sau extern) */
  imagine?: string;
  imagineCredit?: string;
}

async function loadDemo() {
  const { DEMO_ARTICOLE, DEMO_TICKER } = await import("./demo-articles");
  return { articole: DEMO_ARTICOLE, ticker: DEMO_TICKER };
}

export async function getArticles(): Promise<Article[]> {
  const db = getDb();
  if (!db) return (await loadDemo()).articole;
  try {
    const snap = await getDocs(collection(db, "articles"));
    if (snap.empty) return (await loadDemo()).articole;
    const articole = snap.docs
      .map((d) => ({ ...d.data(), id: d.id }) as Article)
      .filter((a) => a.status !== "draft");
    // Cele mai noi primele
    articole.sort((a, b) => (b.publicatLa ?? "").localeCompare(a.publicatLa ?? ""));
    return articole;
  } catch (err) {
    console.warn("Firestore indisponibil, folosesc articolele demo:", err);
    return (await loadDemo()).articole;
  }
}

export async function getArticleById(id: string): Promise<Article | undefined> {
  const db = getDb();
  if (!db) return (await loadDemo()).articole.find((a) => a.id === id);
  try {
    const snap = await getDoc(doc(db, "articles", id));
    if (!snap.exists()) return undefined;
    return { ...snap.data(), id: snap.id } as Article;
  } catch (err) {
    console.warn("Firestore indisponibil, folosesc articolele demo:", err);
    return (await loadDemo()).articole.find((a) => a.id === id);
  }
}

export async function getTickerItems(): Promise<string[]> {
  const db = getDb();
  if (!db) return (await loadDemo()).ticker;
  try {
    const snap = await getDoc(doc(db, "config", "ticker"));
    const items = snap.exists() ? (snap.data().items as string[]) : [];
    return items?.length ? items : (await loadDemo()).ticker;
  } catch {
    return (await loadDemo()).ticker;
  }
}

/** Alege articolul principal: primul breaking, altfel prima știre serioasă */
export function pickLead(articole: Article[]): Article {
  return (
    articole.find((a) => a.badge === "breaking") ??
    articole.find((a) => !a.buzz) ??
    articole[0]
  );
}
