/**
 * Starea formularului de articol din admin + conversii spre/dinspre
 * modelul Article din Firestore și articolul generat de AI.
 */
import type { Article, ArticleBadge, ArticleSocial, QAPair } from "@/lib/articles";
import type { GeneratedArticle } from "@/lib/ai-types";
import {
  DEFAULT_BLOCK_ORDER,
  workflowMeta,
  type WorkflowState,
} from "@/lib/engine/publication";

export const CATEGORII = [
  "Actualitate",
  "Business",
  "AI & Tech",
  "Politică",
  "Geopolitică",
  "Monden",
  "Viral",
];
export const CATEGORII_BUZZ = new Set(["Monden", "Viral"]);

export interface FormState {
  id: string;
  titlu: string;
  sumar: string;
  categorie: string;
  breaking: boolean;
  citire: string;
  fapt: string;
  deCeConteaza: string;
  unghi: string;
  opinie: string;
  predictie: string;
  dezbatere: string;
  qa: QAPair[];
  /** Ordinea blocurilor de conținut (drag & drop în Studio) */
  blockOrder: string[];
  taguri: string; // separate prin virgulă
  seoTitle: string;
  metaDescription: string;
  keywords: string; // separate prin virgulă
  canonical: string;
  sursaNume: string;
  sursaUrl: string;
  autor: string;
  imagineSugestie: string;
  imagineUrl: string;
  imagineCredit: string;
}

export const FORM_GOL: FormState = {
  id: "",
  titlu: "",
  sumar: "",
  categorie: "Actualitate",
  breaking: false,
  citire: "",
  fapt: "",
  deCeConteaza: "",
  unghi: "",
  opinie: "",
  predictie: "",
  dezbatere: "",
  qa: [{ q: "", a: "" }],
  blockOrder: DEFAULT_BLOCK_ORDER,
  taguri: "",
  seoTitle: "",
  metaDescription: "",
  keywords: "",
  canonical: "",
  sursaNume: "",
  sursaUrl: "",
  autor: "",
  imagineSugestie: "",
  imagineUrl: "",
  imagineCredit: "",
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function estimateCitire(...texte: string[]): string {
  const cuvinte = texte.join(" ").split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(cuvinte / 200))} min`;
}

export function dataAfisata(d: Date): string {
  const zi = d.toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const ora = d.toLocaleTimeString("ro-RO", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${zi}, ${ora}`;
}

function splitList(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

export function articleToForm(a: Article): FormState {
  return {
    id: a.id,
    titlu: a.titlu,
    sumar: a.sumar,
    categorie: a.categorie,
    breaking: a.badge === "breaking",
    citire: a.citire,
    fapt: a.fapt,
    deCeConteaza: a.deCeConteaza ?? "",
    unghi: a.unghi,
    opinie: a.opinie,
    predictie: a.predictie,
    dezbatere: a.dezbatere,
    qa: a.qa.length ? a.qa : [{ q: "", a: "" }],
    blockOrder: a.blockOrder?.length ? a.blockOrder : DEFAULT_BLOCK_ORDER,
    taguri: (a.taguri ?? []).join(", "),
    seoTitle: a.seo?.title ?? "",
    metaDescription: a.seo?.metaDescription ?? "",
    keywords: (a.seo?.keywords ?? []).join(", "),
    canonical: a.seo?.canonical ?? "",
    sursaNume: a.sursa?.nume ?? "",
    sursaUrl: a.sursa?.url ?? "",
    autor: a.sursa?.autor ?? "",
    imagineSugestie: a.imagineSugestie ?? "",
    imagineUrl: a.imagine ?? "",
    imagineCredit: a.imagineCredit ?? "",
  };
}

export function generatedToForm(g: GeneratedArticle, sourceUrl: string): FormState {
  return {
    ...FORM_GOL,
    titlu: g.titlu,
    sumar: g.sumar,
    categorie: CATEGORII.includes(g.categorie) ? g.categorie : "Actualitate",
    breaking: g.breaking,
    fapt: g.fapt,
    deCeConteaza: g.deCeConteaza ?? "",
    unghi: g.unghi,
    opinie: g.opinie,
    predictie: g.predictie,
    dezbatere: g.dezbatere,
    qa: g.qa.length ? g.qa : [{ q: "", a: "" }],
    taguri: g.taguri.join(", "),
    seoTitle: g.seoTitle,
    metaDescription: g.metaDescription,
    keywords: g.keywords.join(", "),
    canonical: sourceUrl,
    sursaNume: g.sursaNume,
    sursaUrl: sourceUrl,
    autor: g.autor,
    imagineSugestie: g.imagineSugestie,
    imagineUrl: g.imagineUrl ?? "",
    imagineCredit: g.imagineUrl && g.sursaNume ? `Foto: ${g.sursaNume}` : "",
  };
}

/**
 * Construiește documentul Firestore. Firestore respinge valorile undefined,
 * așa că obiectele opționale se adaugă doar dacă au conținut.
 *
 * Starea publică (status) derivă din workflow: published/scheduled = live,
 * restul = draft. Pentru scheduled, publicatLa = ora programată — site-ul
 * (randat per cerere) îl afișează automat când ora trece.
 */
export function formToArticle(
  form: FormState,
  opts: {
    workflow: WorkflowState;
    scheduledFor?: string;
    existent?: Article;
    social?: ArticleSocial | null;
  }
): Omit<Article, "id"> {
  const buzz = CATEGORII_BUZZ.has(form.categorie);
  const badge: ArticleBadge = form.breaking ? "breaking" : buzz ? "buzz" : "blue";
  const acum = new Date();
  const live = workflowMeta(opts.workflow).live;

  let publicatLa = opts.existent?.publicatLa ?? acum.toISOString();
  let data = opts.existent?.data ?? dataAfisata(acum);
  if (opts.workflow === "scheduled" && opts.scheduledFor) {
    publicatLa = new Date(opts.scheduledFor).toISOString();
    data = dataAfisata(new Date(opts.scheduledFor));
  } else if (opts.workflow === "published" && opts.existent?.status !== "publicat") {
    // Prima publicare: momentul de acum devine data articolului
    publicatLa = acum.toISOString();
    data = dataAfisata(acum);
  }

  const articol: Omit<Article, "id"> = {
    publicatLa,
    data,
    categorie: form.categorie,
    badge,
    buzz,
    titlu: form.titlu,
    sumar: form.sumar,
    citire:
      form.citire ||
      estimateCitire(
        form.fapt,
        form.deCeConteaza,
        form.unghi,
        form.opinie,
        form.predictie
      ),
    fapt: form.fapt,
    unghi: form.unghi,
    opinie: form.opinie,
    predictie: form.predictie,
    dezbatere: form.dezbatere,
    qa: form.qa.filter((p) => p.q.trim() && p.a.trim()),
    status: live ? "publicat" : "draft",
    workflow: opts.workflow,
  };

  if (form.deCeConteaza.trim()) articol.deCeConteaza = form.deCeConteaza.trim();
  if (form.blockOrder.length) articol.blockOrder = form.blockOrder;

  const taguri = splitList(form.taguri);
  if (taguri.length) articol.taguri = taguri;

  const seo: NonNullable<Article["seo"]> = {};
  if (form.seoTitle.trim()) seo.title = form.seoTitle.trim();
  if (form.metaDescription.trim()) seo.metaDescription = form.metaDescription.trim();
  const keywords = splitList(form.keywords);
  if (keywords.length) seo.keywords = keywords;
  if (form.canonical.trim()) seo.canonical = form.canonical.trim();
  if (Object.keys(seo).length) articol.seo = seo;

  const sursa: NonNullable<Article["sursa"]> = {};
  if (form.sursaNume.trim()) sursa.nume = form.sursaNume.trim();
  if (form.sursaUrl.trim()) sursa.url = form.sursaUrl.trim();
  if (form.autor.trim()) sursa.autor = form.autor.trim();
  if (Object.keys(sursa).length) articol.sursa = sursa;

  if (form.imagineSugestie.trim()) articol.imagineSugestie = form.imagineSugestie.trim();
  if (form.imagineUrl.trim()) articol.imagine = form.imagineUrl.trim();
  if (form.imagineCredit.trim()) articol.imagineCredit = form.imagineCredit.trim();
  if (opts.social && Object.values(opts.social).some(Boolean)) {
    articol.social = opts.social;
  }

  return articol;
}
