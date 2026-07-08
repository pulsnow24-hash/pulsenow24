/**
 * Funcțiile AI ale redacției PulsNow24, pe Claude API.
 *
 * - generateArticle: URL sau text → articol complet în formatul PulsNow24
 * - generateSocial: articol → postări pentru rețelele sociale
 * - scoreNewsItems: știri din RSS → scor de importanță + categorie
 *
 * Necesită ANTHROPIC_API_KEY în mediu.
 */
import Anthropic from "@anthropic-ai/sdk";
import type {
  GeneratedArticle,
  InboxScoredItem,
  SocialPosts,
} from "@/lib/ai-types";

const MODEL = "claude-opus-4-8";

const CATEGORII = [
  "Actualitate",
  "Business",
  "AI & Tech",
  "Politică",
  "Geopolitică",
  "Monden",
  "Viral",
];

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY lipsește — adaugă cheia în .env.local (local) sau ca secret în App Hosting (producție)."
    );
  }
  return new Anthropic();
}

function textOf(message: Anthropic.Message): string {
  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Răspunsul AI nu conține text");
  }
  return block.text;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** Extrage imaginea principală declarată de pagină (og:image / twitter:image) */
function extractMainImage(html: string, baseUrl: string): string {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      try {
        return new URL(decodeEntities(match[1]), baseUrl).href;
      } catch {
        // URL invalid — încearcă următorul pattern
      }
    }
  }
  return "";
}

/** Descarcă pagina și extrage textul brut + imaginea principală */
export async function fetchPage(
  url: string
): Promise<{ text: string; imageUrl: string }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`Nu am putut descărca pagina (HTTP ${res.status})`);
  }
  const html = await res.text();
  const text = decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ");
  return { text: text.slice(0, 30000), imageUrl: extractMainImage(html, url) };
}

const QA_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: { q: { type: "string" }, a: { type: "string" } },
    required: ["q", "a"],
    additionalProperties: false,
  },
};

const ARTICLE_SCHEMA = {
  type: "object",
  properties: {
    titlu: { type: "string" },
    sumar: { type: "string" },
    categorie: { type: "string", enum: CATEGORII },
    breaking: { type: "boolean" },
    fapt: { type: "string" },
    unghi: { type: "string" },
    opinie: { type: "string" },
    predictie: { type: "string" },
    dezbatere: { type: "string" },
    qa: QA_SCHEMA,
    taguri: { type: "array", items: { type: "string" } },
    seoTitle: { type: "string" },
    metaDescription: { type: "string" },
    keywords: { type: "array", items: { type: "string" } },
    imagineSugestie: { type: "string" },
    sursaNume: { type: "string" },
    autor: { type: "string" },
  },
  required: [
    "titlu",
    "sumar",
    "categorie",
    "breaking",
    "fapt",
    "unghi",
    "opinie",
    "predictie",
    "dezbatere",
    "qa",
    "taguri",
    "seoTitle",
    "metaDescription",
    "keywords",
    "imagineSugestie",
    "sursaNume",
    "autor",
  ],
  additionalProperties: false,
};

const REDACTOR_SYSTEM = `Ești redactor senior la PulsNow24, un site românesc de știri cu sloganul "Pulsul zilei, pe scurt". Scrii exclusiv în limba română, clar și fără clișee.

Formatul editorial PulsNow24 pentru fiecare articol:
- FAPT VERIFICAT: doar faptele confirmate din sursă, fără interpretare (2-4 fraze).
- UNGHIUL ASCUNS: ce nu spune sursa direct — contextul, interesele, implicațiile (2-3 fraze).
- OPINIA PULSNOW24: o poziție editorială echilibrată dar cu personalitate, începe cu "Părerea PulsNow24:" (2-3 fraze).
- PREDICȚIA: ce anticipăm că urmează, formulat prudent ("Estimăm...", "Anticipăm...") (1-2 fraze).
- ÎNTREBAREA DE DEZBATERE: o singură întrebare care invită cititorii la discuție.
- RĂSPUNS RAPID: exact 3 perechi întrebare-răspuns scurte, formulate cum ar căuta oamenii pe Google.

Reguli stricte:
- Rescrie TOT în cuvintele tale. Nu prelua fraze din sursă. Nu inventa fapte, cifre sau declarații care nu apar în sursă.
- titlu: max 90 de caractere, concret, fără clickbait gol.
- sumar: 1-2 fraze pentru cardul de pe prima pagină.
- breaking: true doar pentru știri majore de ultimă oră.
- seoTitle: max 60 de caractere. metaDescription: max 155 de caractere. keywords: 5-8 expresii de căutare.
- taguri: 3-6 taguri scurte, cu minuscule.
- imagineSugestie: o descriere scurtă a imaginii ideale pentru articol (pentru fotograf/editor).
- sursaNume: numele publicației-sursă dacă reiese din text, altfel "".
- autor: autorul materialului-sursă dacă e menționat, altfel "".`;

export async function generateArticle(input: {
  url?: string;
  text?: string;
}): Promise<GeneratedArticle> {
  const client = getClient();
  let sourceText = input.text ?? "";
  let imageUrl = "";
  if (input.url) {
    const page = await fetchPage(input.url);
    sourceText = page.text;
    imageUrl = page.imageUrl;
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: REDACTOR_SYSTEM,
    output_config: {
      format: { type: "json_schema", schema: ARTICLE_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: `Transformă următorul material-sursă într-un articol complet în formatul PulsNow24.${
          input.url ? ` Sursa: ${input.url}` : ""
        }\n\n<material_sursa>\n${sourceText}\n</material_sursa>`,
      },
    ],
  });

  const articol = JSON.parse(textOf(response)) as GeneratedArticle;
  // Imaginea vine din metadatele paginii (og:image), nu de la model
  articol.imagineUrl = imageUrl;
  return articol;
}

const SOCIAL_SCHEMA = {
  type: "object",
  properties: {
    facebook: { type: "string" },
    instagram: { type: "string" },
    x: { type: "string" },
    linkedin: { type: "string" },
    tiktok: { type: "string" },
  },
  required: ["facebook", "instagram", "x", "linkedin", "tiktok"],
  additionalProperties: false,
};

export async function generateSocial(article: {
  titlu: string;
  sumar: string;
  fapt: string;
  opinie: string;
  dezbatere: string;
}): Promise<SocialPosts> {
  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: `Ești social media manager la PulsNow24 (site românesc de știri). Scrii postări în română, adaptate fiecărei platforme:
- facebook: 2-4 fraze cu cârlig emoțional + întrebarea de dezbatere la final. 1-2 emoji.
- instagram: caption scurt + 5-8 hashtaguri relevante pe ultima linie.
- x: max 270 de caractere, direct, o singură idee.
- linkedin: ton profesional, unghiul de business/implicații, fără emoji.
- tiktok: idee de clip de 20-30 secunde: hook-ul din prima secundă + textul de voiceover.
Nu inventa fapte. Nu pune linkuri — se adaugă la publicare.`,
    output_config: {
      format: { type: "json_schema", schema: SOCIAL_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: `Generează postările pentru acest articol:\n\nTitlu: ${article.titlu}\nSumar: ${article.sumar}\nFapt: ${article.fapt}\nOpinia PulsNow24: ${article.opinie}\nÎntrebare de dezbatere: ${article.dezbatere}`,
      },
    ],
  });

  return JSON.parse(textOf(response)) as SocialPosts;
}

const SCORING_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          importanceScore: { type: "integer" },
          trustScore: { type: "integer" },
          viralScore: { type: "integer" },
          seoScore: { type: "integer" },
          fakeNewsRisk: { type: "integer" },
          categorie: { type: "string", enum: CATEGORII },
          countryCode: { type: "string" },
          priority: {
            type: "string",
            enum: ["breaking", "high", "normal", "low"],
          },
          readingTime: { type: "integer" },
          isDuplicate: { type: "boolean" },
          keep: { type: "boolean" },
          reason: { type: "string" },
        },
        required: [
          "index",
          "importanceScore",
          "trustScore",
          "viralScore",
          "seoScore",
          "fakeNewsRisk",
          "categorie",
          "countryCode",
          "priority",
          "readingTime",
          "isDuplicate",
          "keep",
          "reason",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

const SCORING_SYSTEM = `Ești editorul-șef de gardă la PulsNow24, un site românesc de știri (business, AI & tech, politică, geopolitică, actualitate, plus monden și viral). Evaluezi în timp real știrile din fluxurile RSS și le acorzi scoruri pentru redacție.

Pentru FIECARE știre din listă, evaluează pe o scară 0-100:
- importanceScore: cât de importantă e pentru publicul român acum (impact larg, urgență, miză, interes de căutare). O știre locală minoră = 20-40; o decizie majoră națională sau internațională = 85-100.
- trustScore: încrederea în sursă și în modul de relatare (sursă consacrată + relatare factuală, echilibrată = mare; titlu senzaționalist, sursă obscură, zvon = mic).
- viralScore: potențialul de distribuire pe rețele (emoție, controversă, factor de surpriză, relatabilitate).
- seoScore: potențialul de trafic organic (volum de căutare al subiectului, cât timp rămâne relevant, cât de mult caută oamenii activ).
- fakeNewsRisk: 0 = perfect verificabil și credibil, 100 = probabil fals/dezinformare/clickbait înșelător. Fii atent la titluri prea bune ca să fie adevărate și la surse dubioase.

Și clasifică:
- categorie: cea mai potrivită categorie PulsNow24.
- countryCode: codul ISO 3166-1 alpha-2 al țării de care ține știrea (ex: RO, US, FR, DE, GB, UA, RU). Folosește "EU" pentru Uniunea Europeană în ansamblu și "XX" pentru știri globale, fără o țară anume.
- priority: "breaking" DOAR pentru știri majore de ultimă oră care schimbă ziua; "high" pentru știri importante; "normal" pentru relevante obișnuite; "low" pentru minore. Fii zgârcit cu "breaking".
- readingTime: estimarea timpului de citire al articolului final, în minute întregi (de obicei 2-5).
- isDuplicate: true dacă știrea relatează același eveniment ca o altă știre DE MAI DEVREME în listă (păstrează false pentru prima apariție, true pentru dubluri).
- keep: false dacă e irelevantă pentru un site de știri generale (horoscop, rețete, publicitate, update pur tehnic), altfel true.
- reason: o singură frază scurtă în română care justifică evaluarea.

Fii calibrat și onest — nu umfla scorurile. Distribuie-le pe tot intervalul.`;

export interface RawNewsItem {
  titlu: string;
  link: string;
  sursa: string;
  descriere: string;
  publicatLa: string;
}

interface RawScore {
  index: number;
  importanceScore: number;
  trustScore: number;
  viralScore: number;
  seoScore: number;
  fakeNewsRisk: number;
  categorie: string;
  countryCode: string;
  priority: InboxScoredItem["priority"];
  readingTime: number;
  isDuplicate: boolean;
  keep: boolean;
  reason: string;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function scoreNewsItems(
  items: RawNewsItem[]
): Promise<InboxScoredItem[]> {
  const client = getClient();
  const listing = items
    .map(
      (item, i) =>
        `${i}. [${item.sursa}] ${item.titlu}${item.descriere ? ` — ${item.descriere.slice(0, 220)}` : ""}`
    )
    .join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: SCORING_SYSTEM,
    output_config: {
      format: { type: "json_schema", schema: SCORING_SCHEMA },
    },
    messages: [
      { role: "user", content: `Evaluează aceste știri:\n\n${listing}` },
    ],
  });

  const parsed = JSON.parse(textOf(response)) as { items: RawScore[] };

  return parsed.items
    .filter((s) => items[s.index])
    .map((s) => ({
      ...items[s.index],
      importanceScore: clamp(s.importanceScore),
      trustScore: clamp(s.trustScore),
      viralScore: clamp(s.viralScore),
      seoScore: clamp(s.seoScore),
      fakeNewsRisk: clamp(s.fakeNewsRisk),
      categorie: s.categorie,
      countryCode: (s.countryCode || "XX").toUpperCase().slice(0, 2),
      priority: s.priority,
      readingTime: Math.max(1, Math.round(s.readingTime || 2)),
      isDuplicate: !!s.isDuplicate,
      keep: !!s.keep,
      reason: s.reason,
    }));
}

const FACTCHECK_SCHEMA = {
  type: "object",
  properties: {
    verdict: {
      type: "string",
      enum: ["credibil", "partial", "indoielnic", "neverificabil"],
    },
    confidence: { type: "integer" },
    summary: { type: "string" },
    redFlags: { type: "array", items: { type: "string" } },
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          claim: { type: "string" },
          assessment: { type: "string" },
        },
        required: ["claim", "assessment"],
        additionalProperties: false,
      },
    },
  },
  required: ["verdict", "confidence", "summary", "redFlags", "claims"],
  additionalProperties: false,
};

export async function factCheckItem(input: {
  url?: string;
  title: string;
  description?: string;
}): Promise<import("@/lib/ai-types").FactCheckResult> {
  const client = getClient();
  let context = `Titlu: ${input.title}`;
  if (input.description) context += `\nDescriere: ${input.description}`;
  if (input.url) {
    try {
      const page = await fetchPage(input.url);
      context += `\n\nConținutul paginii-sursă:\n${page.text.slice(0, 12000)}`;
    } catch {
      context += `\n\n(Nu am putut descărca pagina-sursă — evaluează pe baza titlului.)`;
    }
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    system: `Ești verificator de fapte la PulsNow24. Analizezi o știre și evaluezi credibilitatea ei pe baza cunoștințelor tale și a textului sursă furnizat. Răspunzi în română.

- verdict: "credibil" (bine susținut, plauzibil), "partial" (unele afirmații corecte, altele exagerate/nesusținute), "indoielnic" (semne clare de dezinformare sau clickbait înșelător), "neverificabil" (nu există destule informații pentru a evalua).
- confidence: 0-100, cât de sigur ești de verdict.
- summary: 1-2 fraze cu concluzia.
- redFlags: semnale de alarmă concrete (senzaționalism, sursă unică, lipsă de date, contradicții). Listă goală dacă nu există.
- claims: 2-4 afirmații-cheie din știre, fiecare cu o evaluare scurtă.

Fii echilibrat și prudent — nu declara ceva fals fără temei, dar semnalează clar riscurile.`,
    output_config: {
      format: { type: "json_schema", schema: FACTCHECK_SCHEMA },
    },
    messages: [{ role: "user", content: `Verifică această știre:\n\n${context}` }],
  });

  return JSON.parse(textOf(response)) as import("@/lib/ai-types").FactCheckResult;
}
