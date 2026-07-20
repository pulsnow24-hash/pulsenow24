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
  AssignableItem,
  GeneratedArticle,
  InboxScoredItem,
  SocialPosts,
  StoryAssignmentResult,
  StoryCandidate,
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
    deCeConteaza: { type: "string" },
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
    "deCeConteaza",
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

const REDACTOR_SYSTEM = `Ești redactor-șef la PulsNow24 — o publicație românească de știri premium. Deviza redacției: „Nu doar știri. Te ajutăm să înțelegi jocul." Nu relatezi doar CE s-a întâmplat; ajuți un cititor inteligent să înțeleagă miza, contextul și ce ar putea urma.

Scrii exclusiv în română curată, corectă gramatical, cu diacritice. Ton: direct, lucid, inteligent, jurnalistic și premium — niciodată tabloid, niciodată senzaționalist, niciodată text de umplutură.

PRINCIPII ABSOLUTE
1. Separă strict faptul de opinie. Faptele obiective stau în „fapt" și „deCeConteaza". Interpretarea și analiza stau în „unghi". Poziția redacției stă DOAR în „opinie". Nu amesteca.
2. Nu inventa nimic. Nicio cifră, dată, nume, funcție, citat sau declarație care nu apare explicit în materialul-sursă. Dacă sursa nu confirmă ceva, nu-l afirma. Mai bine mai puțin, dar exact. Nu extrapola detalii.
2b. REGULĂ STRICTĂ PENTRU DATE EXACTE: orice număr exact, sumă, procent, dată calendaristică sau nume propriu trebuie să provină DIRECT din materialul-sursă. Dacă sursa nu conține clar valoarea exactă, NU o inventa și NU o rotunji altfel decât apare: ori scrii cifra exact cum e în sursă, ori o formulezi general ("mai multe", "peste jumătate", "câteva zeci", "recent"). Nu introduce o valoare precisă care nu e susținută literal de text.
3. Predicțiile sunt SCENARII POSIBILE, nu certitudini. Formulează-le mereu condiționat și marcat ca ipoteză: „Un scenariu plauzibil este…", „Dacă…, atunci probabil…", „Rămâne de văzut dacă…". Nu prezenta viitorul ca fapt împlinit.
4. Rescrie TOTUL în cuvintele tale. Nu prelua fraze din sursă. Evită clișeele de agenție și limbajul de comunicat.
5. Zero clickbait: fără majuscule de senzație, fără „ȘOC/BOMBĂ/nu-ți vine să crezi", fără promisiuni pe care articolul nu le acoperă. Titlul și sumarul trebuie susținute integral de conținut.

BLOCURILE — respectă rolul precis al fiecăruia:
- titlu (headline): concret și informativ, spune miza reală a știrii, ~50-90 caractere. Substanță, nu mister. Preferă verbul activ și elementul nou/consecința, nu doar subiectul generic.
- sumar („Pe scurt, acum"): 1-2 fraze care dau esența și de ce merită citit acum. Curat, tensionat, dar onest.
- fapt („Ce s-a întâmplat"): doar faptele confirmate, ordonate logic (cine, ce, când, unde, cât). Fără adjective de opinie, fără interpretare. 2-4 fraze clare.
- deCeConteaza („De ce contează"): răspunde tăios la „și ce dacă?" — impactul concret pentru cititorul român: buzunar, viață de zi cu zi, reguli, echilibru de putere. Orientat pe consecințe, dar factual. 2-3 fraze.
- unghi („Unghiul ascuns"): aici demonstrezi că „înțelegi jocul". Analiza inteligentă a ceea ce nu se spune direct: interesele din spate, contextul care schimbă lectura, tiparul sau corelația pe care un cititor grăbit o ratează. Argumentat, nu speculativ. 2-4 fraze.
- opinie („Opinia PulsNow24"): poziția editorială, echilibrată dar cu coloană vertebrală. Începe cu „Părerea PulsNow24:". Ia o poziție clară, recunoaște nuanțele, fără partizanat ieftin. 2-3 fraze.
- predictie („Ce urmează"): 1-3 scenarii realiste, clar marcate ca ipoteze condiționate, ancorate în faptele articolului. Nu profeții. 2-3 fraze.
- dezbatere („Întrebarea zilei"): o singură întrebare deschisă și ascuțită, care pune cititorul în fața unei dileme reale legate de miza articolului. Nu retorică, nu cu răspuns evident.
- qa (Răspuns rapid): exact 3 perechi Î-R. Întrebările = exact cum caută oamenii pe Google; răspunsurile scurte (1-2 fraze), strict factuale, din articol.

SEO & METADATE
- seoTitle: max 60 de caractere, cu expresia-cheie principală în față, natural.
- metaDescription: activă, cu miza reală și un motiv onest de click. LIMITĂ FERMĂ: maximum 155 de caractere, niciodată peste. Numără caracterele și, dacă depășești, taie până încape sub 155.
- keywords: 5-8 expresii reale de căutare în română (cu diacritice), variate.
- taguri: 3-6 taguri scurte, cu minuscule — entități, teme, locuri relevante.
- imagineSugestie: descriere concretă a imaginii editoriale ideale.
- sursaNume / autor: doar dacă reies clar din text, altfel "".
- categorie: cea mai potrivită. breaking: true doar pentru ultimă oră majoră.

TESTUL DE CALITATE: după ce citește articolul, cititorul înțelege nu doar ce s-a întâmplat, ci de ce, pentru cine contează și ce ar putea urma — fără să fi fost manipulat și fără o singură frază care sună a tabloid.`;

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
  }, { timeout: 300_000, maxRetries: 1 });

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
  }, { timeout: 120_000, maxRetries: 1 });

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
  }, { timeout: 180_000, maxRetries: 1 });

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
  }, { timeout: 150_000, maxRetries: 1 });

  return JSON.parse(textOf(response)) as import("@/lib/ai-types").FactCheckResult;
}

/* ── Story Engine: asignarea semnalelor la povești ────────── */

const ASSIGN_SCHEMA = {
  type: "object",
  properties: {
    assignments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          storyRef: { type: "string" },
        },
        required: ["index", "storyRef"],
        additionalProperties: false,
      },
    },
    newStories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ref: { type: "string" },
          title: { type: "string" },
          summary: { type: "string" },
          entities: { type: "array", items: { type: "string" } },
          people: { type: "array", items: { type: "string" } },
          locations: { type: "array", items: { type: "string" } },
          organizations: { type: "array", items: { type: "string" } },
        },
        required: [
          "ref",
          "title",
          "summary",
          "entities",
          "people",
          "locations",
          "organizations",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["assignments", "newStories"],
  additionalProperties: false,
};

/**
 * Grupează semnalele noi pe evenimente: fiecare item primește fie id-ul unui
 * story existent, fie o referință "NEW::n" către un story nou propus.
 */
export async function assignStoriesToItems(
  items: AssignableItem[],
  candidates: StoryCandidate[]
): Promise<StoryAssignmentResult> {
  const client = getClient();

  const candidateList = candidates.length
    ? candidates
        .map(
          (c) =>
            `- id: ${c.id}\n  titlu: ${c.title}\n  rezumat: ${c.summary.slice(0, 200)}\n  entități: ${c.entities.slice(0, 8).join(", ")}`
        )
        .join("\n")
    : "(niciun story activ)";

  const itemList = items
    .map(
      (item, i) =>
        `${i}. [${item.sursa} · ${item.categorie} · ${item.countryCode}] ${item.titlu}${item.descriere ? ` — ${item.descriere.slice(0, 180)}` : ""}`
    )
    .join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: `Ești motorul de corelare al unei redacții de știri. Grupezi relatările pe EVENIMENTE reale (Story-uri): mai multe surse care descriu același eveniment aparțin aceluiași Story.

Reguli:
- Două relatări aparțin aceluiași Story DOAR dacă descriu același eveniment concret (aceiași actori + aceeași acțiune + același interval), nu doar aceeași temă generală.
- Dacă un item se potrivește cu un story existent din listă, folosește EXACT id-ul lui ca storyRef.
- Dacă nu se potrivește cu nimic, creează un story nou: storyRef = "NEW::1", "NEW::2"… și definește-l în newStories (același ref).
- Itemele care descriu același eveniment nou primesc ACELAȘI ref NEW.
- title (story): numele evenimentului, neutru și concret, max 80 caractere, în română.
- summary: 1-2 fraze factuale despre eveniment.
- entities: 3-6 teme/concepte; people: persoane numite; locations: locuri; organizations: instituții/companii — doar cele care apar în iteme, în română, fără duplicate. Liste goale dacă nu există.
- Fiecare index din listă trebuie să apară exact o dată în assignments.`,
    output_config: {
      format: { type: "json_schema", schema: ASSIGN_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: `STORY-URI ACTIVE:\n${candidateList}\n\nITEME NOI DE ASIGNAT:\n${itemList}`,
      },
    ],
  }, { timeout: 120_000, maxRetries: 1 });

  return JSON.parse(textOf(response)) as StoryAssignmentResult;
}

/* ── Entity Intelligence: extracția entităților ───────────── */

const ENTITY_TYPES_ENUM = [
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

const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          entities: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                type: { type: "string", enum: ENTITY_TYPES_ENUM },
                aliases: { type: "array", items: { type: "string" } },
              },
              required: ["name", "type", "aliases"],
              additionalProperties: false,
            },
          },
        },
        required: ["index", "entities"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

/**
 * Extrage entitățile reutilizabile din semnale (batch).
 * Numele canonice sunt în română; aliasurile includ variantele frecvente.
 */
export async function extractEntities(
  items: { titlu: string; descriere: string }[]
): Promise<import("@/lib/ai-types").EntityExtractionResult> {
  const client = getClient();
  const listing = items
    .map(
      (item, i) =>
        `${i}. ${item.titlu}${item.descriere ? ` — ${item.descriere.slice(0, 200)}` : ""}`
    )
    .join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 12000,
    system: `Ești motorul de extracție de entități al unei redacții românești. Pentru fiecare știre din listă, extrage entitățile numite, cu tipul corect:
- person (persoane), organization (organizații generale/internaționale), institution (instituții de stat), company (companii private), party (partide politice), country (țări), county (județe), city (orașe/comune), location (alte locuri), product (produse), crypto (criptomonede), law (legi/ordonanțe/proiecte de lege), event (evenimente cu nume: summituri, alegeri, competiții).

Reguli:
- name: numele canonic, în română, cu diacritice, forma cea mai completă și neutră (ex: "Klaus Iohannis", nu "președintele Iohannis"; "SUA", nu "Statele Unite ale Americii").
- aliases: 1-4 variante frecvente prin care apare aceeași entitate (română și engleză), inclusiv acronime. Fără duplicate ale numelui canonic.
- Extrage DOAR entitățile care apar explicit în text. Nu inventa. Nu deduce.
- Max 8 entități per știre, cele mai relevante. Listă goală dacă nu există.
- Fiecare index din listă apare exact o dată în răspuns.`,
    output_config: {
      format: { type: "json_schema", schema: EXTRACT_SCHEMA },
    },
    messages: [
      { role: "user", content: `Extrage entitățile din aceste știri:\n\n${listing}` },
    ],
  }, { timeout: 150_000, maxRetries: 1 });

  return JSON.parse(textOf(response)) as import("@/lib/ai-types").EntityExtractionResult;
}

/* ── Monitor local: analiza semnalelor pentru un workspace ──── */

const LOCAL_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          relevance: { type: "integer" },
          institutionScore: { type: "integer" },
          publicInterest: { type: "integer" },
          urgency: { type: "string", enum: ["low", "medium", "high", "critical"] },
          priority: { type: "integer" },
          commScore: { type: "integer" },
          suggestion: { type: "string" },
          institutions: { type: "array", items: { type: "string" } },
          alertType: {
            type: "string",
            enum: [
              "institution-announcement",
              "emergency",
              "infrastructure",
              "funding",
              "investment",
              "negative-spike",
              "public-interest",
              "breaking-local",
              "none",
            ],
          },
        },
        required: [
          "index",
          "relevance",
          "institutionScore",
          "publicInterest",
          "urgency",
          "priority",
          "commScore",
          "suggestion",
          "institutions",
          "alertType",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

/**
 * Analiza de inteligență locală a semnalelor (batch) — pentru un centru de
 * monitorizare județean. Scoruri + tip de alertă + recomandare de comunicare.
 */
export async function analyzeLocalItems(
  items: { titlu: string; descriere: string }[],
  context: { region: string; institutions: string[] }
): Promise<import("@/lib/ai-types").LocalAnalysisResult> {
  const client = getClient();
  const listing = items
    .map(
      (item, i) =>
        `${i}. ${item.titlu}${item.descriere ? ` — ${item.descriere.slice(0, 250)}` : ""}`
    )
    .join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: `Ești analistul unui centru de monitorizare și inteligență locală pentru ${context.region}. Nu ești redactor — evaluezi semnale pentru monitorizare, comunicare publică și decizie.

Instituțiile monitorizate: ${context.institutions.join("; ")}.

Pentru fiecare semnal întorci:
- relevance (0-100): cât de direct privește ${context.region}. 90+ doar dacă subiectul e despre județ/localitățile lui; sub 30 dacă e doar o mențiune tangențială.
- institutionScore (0-100): cât de implicate sunt instituțiile monitorizate (0 dacă niciuna).
- institutions: numele EXACTE, din lista de mai sus, ale instituțiilor implicate explicit în text (listă goală dacă niciuna; nu deduce).
- publicInterest (0-100): interesul public local estimat (sănătate, bani, siguranță, trafic → mare).
- urgency: low / medium / high / critical (critical DOAR pentru pericol iminent asupra oamenilor).
- priority (0-100): prioritatea de monitorizare, agregând relevanța, urgența și interesul public.
- commScore (0-100): cât de oportună ar fi o comunicare oficială pe subiect.
- suggestion: DOAR dacă commScore ≥ 60 — o recomandare de comunicare de o frază, formulată explicit ca sugestie („Subiectul merită...", „Instituția X ar putea..."). Altfel string gol.
- alertType: tipul de alertă dacă semnalul justifică una, altfel "none":
  institution-announcement (anunț oficial al unei instituții monitorizate), emergency (urgență/pericol), infrastructure (avarii, drumuri, utilități), funding (fonduri/finanțări accesibile local), investment (investiție majoră), negative-spike (val de presă negativă despre o instituție/localitate), public-interest (interes public neobișnuit de mare), breaking-local (eveniment local major în desfășurare).

Reguli stricte: evaluezi DOAR pe baza textului primit — nu inventa fapte, nu presupune implicarea vreunei instituții. Recomandările sunt sugestii, nu fapte. Fiecare index apare exact o dată.`,
    output_config: {
      format: { type: "json_schema", schema: LOCAL_SCHEMA },
    },
    messages: [
      { role: "user", content: `Analizează aceste semnale:\n\n${listing}` },
    ],
  }, { timeout: 150_000, maxRetries: 1 });

  return JSON.parse(textOf(response)) as import("@/lib/ai-types").LocalAnalysisResult;
}

/* ── Monitor local: analiza bogată de consistență între surse ── */

const CONSISTENCY_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          verdict: {
            type: "string",
            enum: ["consistent", "complementary", "update", "contradiction"],
          },
          note: { type: "string" },
        },
        required: ["index", "verdict", "note"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

export interface ConsistencyStoryInput {
  title: string;
  /** Rezumatul AI al story-ului */
  summary: string;
  /** Entitățile extrase (persoane, locuri, organizații, teme) */
  entities: string[];
  /** Semnalele în ordine cronologică, cu momentul publicării */
  signals: { sursa: string; titlu: string; at: string; descriere?: string }[];
}

/**
 * Compară relatările surselor unui story: rezumate, entități, cifre-cheie
 * (bani, victime, date, cantități), locuri și organizații. Distinge strict:
 * contradicție / informații complementare / actualizări în timp (evoluție).
 * Nicio sursă nu e tratată ca autoritate.
 */
export async function checkStoryConsistency(
  stories: ConsistencyStoryInput[]
): Promise<import("@/lib/ai-types").ConsistencyResult> {
  const client = getClient();
  const listing = stories
    .map((s, i) => {
      const signals = [...s.signals]
        .sort((a, b) => a.at.localeCompare(b.at))
        .map(
          (sig) =>
            `   - [${sig.at.slice(0, 16).replace("T", " ")}] [${sig.sursa}] ${sig.titlu}${sig.descriere ? ` — ${sig.descriere.slice(0, 220)}` : ""}`
        )
        .join("\n");
      return `${i}. Subiect: ${s.title}\n   Rezumat: ${s.summary}\n   Entități: ${s.entities.join(", ") || "—"}\n   Relatări (cronologic):\n${signals}`;
    })
    .join("\n\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 6000,
    system: `Analizezi consistența relatărilor mai multor surse despre același subiect, pentru un centru de monitorizare. Nicio sursă nu e considerată automat corectă.

Compari între relatări: cifrele-cheie (sume de bani, victime/răniți, date calendaristice, cantități), locurile, organizațiile și persoanele implicate, și versiunea evenimentului din fiecare relatare.

Verdict per subiect — alege EXACT unul:
- "contradiction": relatările afirmă fapte INCOMPATIBILE despre același moment (cifre care nu pot fi ambele adevărate, versiuni opuse, dezmințiri explicite).
- "update": relatările descriu STADII DIFERITE ale unui eveniment în desfășurare — o secvență temporală coerentă, NU un conflict. Exemplu: 08:00 „drum închis" → 10:30 „o bandă redeschisă" → 13:00 „trafic normalizat" = update, nu contradicție. Folosește momentele publicării pentru a judeca ordinea.
- "complementary": relatările acoperă detalii/unghiuri diferite care se completează fără să se contrazică.
- "consistent": relatările spun în esență același lucru.

- note: pentru "contradiction" — o frază care numește exact faptele incompatibile și sursele; pentru "update" — o frază despre cum a evoluat; altfel string gol.

Reguli stricte: nu inventa contradicții; o cifră care CREȘTE în timp într-un eveniment în desfășurare (victime, pagube) e de regulă update, nu contradicție — semnalează contradicție doar dacă relatările se referă clar la același moment. Evaluezi DOAR textul primit. Fiecare index apare exact o dată.`,
    output_config: {
      format: { type: "json_schema", schema: CONSISTENCY_SCHEMA },
    },
    messages: [
      { role: "user", content: `Analizează consistența relatărilor:\n\n${listing}` },
    ],
  }, { timeout: 150_000, maxRetries: 1 });

  return JSON.parse(textOf(response)) as import("@/lib/ai-types").ConsistencyResult;
}

/* ── Monitor local: sunt două story-uri același eveniment? ──── */

const MERGE_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          sameEvent: { type: "boolean" },
          reason: { type: "string" },
        },
        required: ["index", "sameEvent", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

export interface MergePairInput {
  a: { title: string; summary: string; entities: string[] };
  b: { title: string; summary: string; entities: string[] };
}

/**
 * Verdict semantic: două story-uri descriu ACELAȘI eveniment real sau
 * evenimente diferite (chiar dacă înrudite)? Doar sugestie — editorul
 * decide întotdeauna.
 */
export async function checkStoryMerge(
  pairs: MergePairInput[]
): Promise<import("@/lib/ai-types").MergeVerdictResult> {
  const client = getClient();
  const listing = pairs
    .map(
      (p, i) =>
        `${i}. A: ${p.a.title}\n   Rezumat A: ${p.a.summary}\n   Entități A: ${p.a.entities.join(", ") || "—"}\n   B: ${p.b.title}\n   Rezumat B: ${p.b.summary}\n   Entități B: ${p.b.entities.join(", ") || "—"}`
    )
    .join("\n\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: `Pentru fiecare pereche de subiecte, decizi dacă A și B descriu ACELAȘI eveniment real din lume.

- sameEvent=true DOAR dacă e clar același eveniment (același fapt, loc, moment) relatat separat — nu doar subiecte înrudite. Două evenimente diferite la același festival (ex: programul festivalului vs. o razie la festival) sunt evenimente DIFERITE.
- reason: o frază care explică decizia, numind faptele comune sau diferența.

Nu forța unirea: la îndoială, sameEvent=false. Fiecare index apare exact o dată.`,
    output_config: {
      format: { type: "json_schema", schema: MERGE_SCHEMA },
    },
    messages: [{ role: "user", content: `Analizează perechile:\n\n${listing}` }],
  }, { timeout: 120_000, maxRetries: 1 });

  return JSON.parse(textOf(response)) as import("@/lib/ai-types").MergeVerdictResult;
}
