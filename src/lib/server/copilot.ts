/**
 * AI Copilot — motorul acțiunilor din Studio.
 *
 * Fiecare acțiune e o intrare în registru: un fel de rezultat (text / opțiuni /
 * listă / întrebări-răspunsuri) + instrucțiunea pentru model. Adăugarea unei
 * acțiuni noi = o intrare nouă aici, fără modificări în UI-ul generic.
 */
import Anthropic from "@anthropic-ai/sdk";
import type {
  CopilotRequest,
  CopilotResult,
  CopilotArticleContext,
} from "@/lib/ai-types";

const MODEL = "claude-opus-4-8";

type ResultKind = CopilotResult["kind"];

interface CopilotAction {
  kind: ResultKind;
  /** Acțiunea cere un bloc-țintă (rescrie/scurtează/…)? */
  needsTarget?: boolean;
  maxTokens?: number;
  instruction: (req: CopilotRequest) => string;
}

const SYSTEM = `Ești copilotul editorial al unei redacții românești de știri moderne (stil PulsNow24: clar, factual, fără clișee, fără clickbait gol). Răspunzi întotdeauna în română, cu excepția cazurilor în care ți se cere explicit altă limbă. Scrii concis și natural — texte gata de publicat, nu explicații despre ele. Nu inventa fapte care nu apar în contextul primit.`;

function articleContext(a: CopilotArticleContext): string {
  const lines = [
    `Titlu: ${a.titlu}`,
    a.sumar && `Pe scurt: ${a.sumar}`,
    a.fapt && `Ce s-a întâmplat: ${a.fapt}`,
    a.deCeConteaza && `De ce contează: ${a.deCeConteaza}`,
    a.unghi && `Unghiul ascuns: ${a.unghi}`,
    a.opinie && `Opinia redacției: ${a.opinie}`,
    a.predictie && `Ce urmează: ${a.predictie}`,
    a.dezbatere && `Întrebarea de dezbatere: ${a.dezbatere}`,
    a.categorie && `Categorie: ${a.categorie}`,
    a.taguri && `Taguri: ${a.taguri}`,
    a.keywords && `Keywords SEO: ${a.keywords}`,
    a.sursaNume && `Sursă: ${a.sursaNume}`,
  ].filter(Boolean);
  return lines.join("\n");
}

function targetContext(req: CopilotRequest): string {
  const t = req.target;
  if (!t) return "";
  return `\n\nBLOCUL-ȚINTĂ („${t.label}"):\n${t.text}${t.hint ? `\n\nRolul blocului: ${t.hint}` : ""}`;
}

const ACTIONS: Record<string, CopilotAction> = {
  /* ── Titlu ── */
  "improve-headline": {
    kind: "options",
    instruction: (r) =>
      `Propune 5 variante mai bune de titlu pentru articolul de mai jos. Concrete, max 90 de caractere, fără clickbait gol, fiecare cu alt unghi (factual, impact, întrebare, cifră, tensiune).\n\n${articleContext(r.article)}`,
  },

  /* ── Bloc activ ── */
  rewrite: {
    kind: "text",
    needsTarget: true,
    instruction: (r) =>
      `Rescrie blocul-țintă păstrând sensul și rolul lui, dar cu o formulare mai bună: mai clară, mai vie, fără repetiții. Păstrează aproximativ aceeași lungime. Întoarce DOAR textul rescris.\n\n${articleContext(r.article)}${targetContext(r)}`,
  },
  shorten: {
    kind: "text",
    needsTarget: true,
    instruction: (r) =>
      `Scurtează blocul-țintă la jumătate, păstrând informația esențială și rolul lui editorial. Întoarce DOAR textul scurtat.\n\n${articleContext(r.article)}${targetContext(r)}`,
  },
  expand: {
    kind: "text",
    needsTarget: true,
    instruction: (r) =>
      `Extinde blocul-țintă cu 50-80%, adăugând context și claritate FĂRĂ a inventa fapte noi — dezvoltă doar ce există deja în articol. Întoarce DOAR textul extins.\n\n${articleContext(r.article)}${targetContext(r)}`,
  },
  "tone-professional": {
    kind: "text",
    needsTarget: true,
    instruction: (r) =>
      `Rescrie blocul-țintă pe un ton profesional, sobru, de publicație de business — fără a-l lungi. Întoarce DOAR textul rescris.\n\n${articleContext(r.article)}${targetContext(r)}`,
  },
  "tone-neutral": {
    kind: "text",
    needsTarget: true,
    instruction: (r) =>
      `Rescrie blocul-țintă pe un ton strict neutru, echidistant, eliminând orice încărcătură emoțională sau părtinire. Întoarce DOAR textul rescris.\n\n${articleContext(r.article)}${targetContext(r)}`,
  },
  "seo-optimize": {
    kind: "text",
    needsTarget: true,
    instruction: (r) =>
      `Rescrie blocul-țintă optimizat SEO: integrează natural expresiile pe care oamenii le caută pe Google despre acest subiect (folosește și keywords-urile din context, dacă există), fără keyword stuffing și fără a suna robotic. Întoarce DOAR textul rescris.\n\n${articleContext(r.article)}${targetContext(r)}`,
  },
  "regenerate-block": {
    kind: "text",
    needsTarget: true,
    instruction: (r) =>
      `Scrie de la zero blocul-țintă pe baza restului articolului, respectând strict rolul lui editorial. Întoarce DOAR textul blocului.\n\n${articleContext(r.article)}${targetContext(r)}`,
  },

  /* ── SEO ── */
  "meta-description": {
    kind: "text",
    instruction: (r) =>
      `Scrie meta description pentru acest articol: max 155 de caractere, activă, cu esența știrii și un cârlig de click onest. Întoarce DOAR textul.\n\n${articleContext(r.article)}`,
  },
  keywords: {
    kind: "list",
    instruction: (r) =>
      `Generează 6-8 expresii-cheie SEO (cum ar căuta oamenii pe Google acest subiect, în română, cu diacritice). O expresie per element.\n\n${articleContext(r.article)}`,
  },
  faq: {
    kind: "qa",
    instruction: (r) =>
      `Generează exact 3 perechi întrebare-răspuns pentru secțiunea „Răspuns rapid": întrebările formulate cum caută oamenii pe Google, răspunsurile scurte și factuale (1-2 fraze), doar din informațiile articolului.\n\n${articleContext(r.article)}`,
  },

  /* ── Conținut ── */
  timeline: {
    kind: "list",
    instruction: (r) =>
      `Construiește o cronologie a evenimentelor din articol: 4-7 momente, fiecare element în formatul „Dată/moment — ce s-a întâmplat". Folosește DOAR informații din articol; dacă datele exacte lipsesc, folosește repere relative („Anterior", „Astăzi", „Urmează").\n\n${articleContext(r.article)}`,
  },
  "fact-check": {
    kind: "text",
    maxTokens: 3000,
    instruction: (r) =>
      `Fă o verificare editorială a articolului: semnalează afirmațiile care au nevoie de sursă suplimentară, exagerările, cifrele neverificabile și formulările riscante juridic. Structurează pe puncte scurte. Dacă totul e solid, spune explicit.\n\n${articleContext(r.article)}`,
  },
  "source-summary": {
    kind: "text",
    instruction: (r) =>
      `Rezumă în 3-4 fraze ce spune sursa originală (${r.article.sursaNume || "sursa"}) și menționează ce unghi a ales ea, pentru nota de redacție.\n\n${articleContext(r.article)}`,
  },

  /* ── Distribuție ── */
  facebook: {
    kind: "text",
    instruction: (r) =>
      `Scrie postarea de Facebook pentru acest articol: 2-4 fraze cu cârlig emoțional onest, încheiată cu întrebarea de dezbatere. 1-2 emoji, fără linkuri.\n\n${articleContext(r.article)}`,
  },
  instagram: {
    kind: "text",
    instruction: (r) =>
      `Scrie captionul de Instagram: scurt, cu personalitate, apoi 5-8 hashtaguri relevante pe ultima linie.\n\n${articleContext(r.article)}`,
  },
  "x-thread": {
    kind: "list",
    instruction: (r) =>
      `Scrie un thread pentru X (Twitter) din 4-6 postări: prima e hook-ul (max 260 caractere), fiecare postare de sine stătătoare, ultima cu întrebarea de dezbatere. Un element per postare, fără numerotare în text.\n\n${articleContext(r.article)}`,
  },
  linkedin: {
    kind: "text",
    instruction: (r) =>
      `Scrie postarea de LinkedIn: ton profesional, unghiul de business/implicații, 4-6 fraze, fără emoji și fără hashtaguri excesive (max 3 la final).\n\n${articleContext(r.article)}`,
  },
  newsletter: {
    kind: "text",
    maxTokens: 3000,
    instruction: (r) =>
      `Scrie secțiunea de newsletter pentru acest articol: un subiect de email captivant pe prima linie (prefixat cu „Subiect: "), apoi 2 paragrafe scurte care rezumă știrea pe tonul unei scrisori către un prieten inteligent, și o frază de încheiere care invită la citirea articolului complet.\n\n${articleContext(r.article)}`,
  },
  "push-notification": {
    kind: "text",
    instruction: (r) =>
      `Scrie notificarea push pentru această știre: max 110 caractere, urgentă dar onestă, fără emoji.\n\n${articleContext(r.article)}`,
  },
  "tiktok-carousel": {
    kind: "list",
    instruction: (r) =>
      `Creează un carusel TikTok/Instagram de 6-8 slide-uri pentru această știre. Primul slide = hook puternic (max 8 cuvinte). Fiecare element din listă e textul unui slide: scurt, punchy, max 15 cuvinte. Ultimul slide = call-to-action cu întrebarea de dezbatere.\n\n${articleContext(r.article)}`,
  },
  "image-prompt": {
    kind: "text",
    instruction: (r) =>
      `Write an English image-generation prompt for this news article's hero image: photorealistic editorial photography style, concrete scene description, no text in image, no real people's faces. One paragraph. Return ONLY the prompt in English.\n\n${articleContext(r.article)}`,
  },
};

export const COPILOT_ACTIONS = Object.keys(ACTIONS);

const SCHEMAS: Record<ResultKind, Record<string, unknown>> = {
  text: {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
    additionalProperties: false,
  },
  options: {
    type: "object",
    properties: { options: { type: "array", items: { type: "string" } } },
    required: ["options"],
    additionalProperties: false,
  },
  list: {
    type: "object",
    properties: { items: { type: "array", items: { type: "string" } } },
    required: ["items"],
    additionalProperties: false,
  },
  qa: {
    type: "object",
    properties: {
      qa: {
        type: "array",
        items: {
          type: "object",
          properties: { q: { type: "string" }, a: { type: "string" } },
          required: ["q", "a"],
          additionalProperties: false,
        },
      },
    },
    required: ["qa"],
    additionalProperties: false,
  },
};

export async function runCopilot(req: CopilotRequest): Promise<CopilotResult> {
  const action = ACTIONS[req.action];
  if (!action) throw new Error(`Acțiune necunoscută: ${req.action}`);
  if (action.needsTarget && !req.target?.text?.trim()) {
    throw new Error("Selectează un bloc cu conținut pentru această acțiune.");
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY lipsește — adaugă cheia în .env.local (local) sau ca secret în App Hosting (producție)."
    );
  }

  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: action.maxTokens ?? 2000,
    system: SYSTEM,
    output_config: {
      format: { type: "json_schema", schema: SCHEMAS[action.kind] },
    },
    messages: [{ role: "user", content: action.instruction(req) }],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Răspunsul AI nu conține text");
  }
  const parsed = JSON.parse(block.text) as Record<string, unknown>;
  return { kind: action.kind, ...parsed } as CopilotResult;
}
