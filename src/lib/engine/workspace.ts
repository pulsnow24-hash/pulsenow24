/**
 * News Platform Engine — workspace-uri și inteligență locală.
 *
 * Un workspace este o LENTILĂ peste aceleași motoare (Inbox, Story, Entity,
 * Sources) — nu o copie a lor. Datele primesc etichete de workspace la
 * import, iar view-urile filtrează după workspace-ul activ. Logica de aici
 * e pură (fără I/O), reutilizabilă de orice instanță locală viitoare.
 */
import { normalizeAlias, entityId, type Entity } from "./entity";

/* ── Workspace-uri ──────────────────────────────────────────── */

export type Workspace = "national" | "valcea";

export interface WorkspaceDef {
  id: Workspace;
  label: string;
  emoji: string;
  description: string;
}

export const WORKSPACES: WorkspaceDef[] = [
  {
    id: "national",
    label: "PulsNow24",
    emoji: "🇷🇴",
    description: "Redacția națională",
  },
  {
    id: "valcea",
    label: "Monitor Vâlcea",
    emoji: "📍",
    description: "Centru de monitorizare și inteligență locală",
  },
];

/* ── Tipuri de surse (conectori) ───────────────────────────── */

export type SourceKind =
  | "rss"
  | "website"
  | "facebook"
  | "youtube"
  | "institution"
  | "press-release"
  | "custom";

export const SOURCE_KINDS: SourceKind[] = [
  "rss",
  "website",
  "facebook",
  "youtube",
  "institution",
  "press-release",
  "custom",
];

export const SOURCE_KIND_LABELS: Record<SourceKind, string> = {
  rss: "Flux RSS",
  website: "Website",
  facebook: "Pagină Facebook",
  youtube: "Canal YouTube",
  institution: "Instituție publică",
  "press-release": "Comunicate de presă",
  custom: "Conector personalizat",
};

/**
 * Cum se sincronizează o sursă:
 * - "feed"      → automat, prin pipeline-ul RSS existent (URL-ul e un flux)
 * - "connector" → NECESITĂ un conector dedicat (nu simulăm date);
 *                 sursa e stocată și afișată ca „Conector necesar".
 *
 * Facebook nu expune fluxuri publice — întotdeauna conector. YouTube,
 * instituțiile și comunicatele au de regulă fluxuri RSS reale.
 */
export function sourceSyncMode(kind: SourceKind): "feed" | "connector" {
  switch (kind) {
    case "rss":
    case "youtube":
    case "institution":
    case "press-release":
      return "feed";
    case "facebook":
    case "website":
    case "custom":
      return "connector";
  }
}

/* ── Instituții monitorizate ───────────────────────────────── */

export interface MonitoredInstitution {
  id: string;
  name: string;
  /** Legătura către Entity Engine — datele vin de acolo, nu se duplică */
  entityId: string;
  aliases: string[];
}

export function makeInstitution(
  name: string,
  aliases: string[] = []
): MonitoredInstitution {
  const eid = entityId(name, "institution");
  return { id: eid.replace(/^institution-/, ""), name, entityId: eid, aliases };
}

export const DEFAULT_INSTITUTIONS: MonitoredInstitution[] = [
  makeInstitution("Consiliul Județean Vâlcea", ["CJ Vâlcea", "Consiliul Judetean Valcea"]),
  makeInstitution("Primăria Râmnicu Vâlcea", ["Primaria Ramnicu Valcea", "Primăria Rm. Vâlcea"]),
  makeInstitution("Prefectura Vâlcea", ["Instituția Prefectului Vâlcea", "Prefectul de Vâlcea"]),
  makeInstitution("ISU Vâlcea", ["Inspectoratul pentru Situații de Urgență Vâlcea", "ISU General Magheru"]),
  makeInstitution("IPJ Vâlcea", ["Inspectoratul de Poliție Județean Vâlcea", "Poliția Vâlcea"]),
  makeInstitution("DSP Vâlcea", ["Direcția de Sănătate Publică Vâlcea"]),
  makeInstitution("Spitalul Județean Vâlcea", ["Spitalul Județean de Urgență Vâlcea", "SJU Vâlcea"]),
  makeInstitution("Apavil", ["Apavil SA", "Apavil Vâlcea"]),
  makeInstitution("CET Govora", ["CET Govora SA"]),
];

/* ── Cuvinte-cheie urmărite ────────────────────────────────── */

export const DEFAULT_KEYWORDS: string[] = [
  "Vâlcea",
  "Valcea",
  "Râmnicu Vâlcea",
  "Ramnicu Valcea",
  "Drăgășani",
  "Horezu",
  "Brezoi",
  "Călimănești",
  "Ocnele Mari",
  "Govora",
  "Voineasa",
  "Băile Olănești",
  "DN7",
  "Valea Oltului",
  "Oltchim",
  "Consiliul Județean Vâlcea",
  "Primăria Râmnicu Vâlcea",
  "ISU Vâlcea",
  "IPJ Vâlcea",
  "Prefectura Vâlcea",
];

export interface WorkspaceConfig {
  keywords: string[];
  institutions: MonitoredInstitution[];
}

export const DEFAULT_VALCEA_CONFIG: WorkspaceConfig = {
  keywords: DEFAULT_KEYWORDS,
  institutions: DEFAULT_INSTITUTIONS,
};

/* ── Potrivirea cuvintelor-cheie ───────────────────────────── */

/**
 * Cuvintele-cheie găsite într-un text: potrivire pe cuvinte întregi,
 * insensibilă la diacritice și majuscule („valcea" prinde „Vâlcea").
 */
export function matchKeywords(text: string, keywords: string[]): string[] {
  const haystack = ` ${normalizeAlias(text)} `;
  const found: string[] = [];
  const seen = new Set<string>();
  for (const kw of keywords) {
    const needle = normalizeAlias(kw);
    if (!needle || seen.has(needle)) continue;
    if (haystack.includes(` ${needle} `)) {
      seen.add(needle);
      found.push(kw);
    }
  }
  return found;
}

/* ── Analiza locală AI (scoruri per semnal) ────────────────── */

export type LocalUrgency = "low" | "medium" | "high" | "critical";

export const URGENCY_LABELS: Record<LocalUrgency, string> = {
  low: "Scăzută",
  medium: "Medie",
  high: "Ridicată",
  critical: "Critică",
};

/** Scorurile locale ale unui semnal — calculate de AI, stocate pe item. */
export interface LocalAnalysis {
  /** 0-100 — cât de relevant e pentru județ */
  relevance: number;
  /** 0-100 — cât de implicate sunt instituțiile monitorizate */
  institutionScore: number;
  /** 0-100 — interesul public local estimat */
  publicInterest: number;
  urgency: LocalUrgency;
  /** 0-100 — prioritatea de monitorizare (agregat) */
  priority: number;
  /** 0-100 — cât de oportună e o comunicare oficială pe subiect */
  commScore: number;
  /** Recomandarea AI de comunicare — sugestie, NU fapt */
  suggestion?: string;
  /** Numele instituțiilor monitorizate implicate */
  institutions: string[];
  /** Cuvintele-cheie care au declanșat analiza */
  keywords: string[];
  alertType?: AlertType | null;
}

/* ── Alerte ────────────────────────────────────────────────── */

export type AlertType =
  | "institution-announcement"
  | "emergency"
  | "infrastructure"
  | "funding"
  | "investment"
  | "negative-spike"
  | "public-interest"
  | "breaking-local";

export const ALERT_TYPES: AlertType[] = [
  "institution-announcement",
  "emergency",
  "infrastructure",
  "funding",
  "investment",
  "negative-spike",
  "public-interest",
  "breaking-local",
];

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  "institution-announcement": "Anunț instituțional",
  emergency: "Urgență",
  infrastructure: "Problemă de infrastructură",
  funding: "Oportunitate de finanțare",
  investment: "Investiție majoră",
  "negative-spike": "Val de presă negativă",
  "public-interest": "Interes public ridicat",
  "breaking-local": "Eveniment local major",
};

export type AlertSeverity = "info" | "attention" | "urgent";

export interface MonitorAlert {
  id: string;
  workspace: Workspace;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  sourceName: string;
  /** Legături prin ID — fără duplicarea datelor */
  itemId: string;
  storyId?: string;
  institutions: string[];
  /** Recomandare AI (dacă există) — marcată ca sugestie, nu ca fapt */
  suggestion?: string;
  at: string;
  status: "new" | "read" | "dismissed";
}

function severityFor(urgency: LocalUrgency, type: AlertType): AlertSeverity {
  if (urgency === "critical" || type === "emergency") return "urgent";
  if (urgency === "high" || type === "breaking-local" || type === "negative-spike")
    return "attention";
  return "info";
}

/** Pragul minim de relevanță locală pentru a genera alertă/etichetă */
export const LOCAL_RELEVANCE_MIN = 40;

/**
 * Derivă alertele unui semnal analizat (pur, determinist).
 * ID-ul e derivat din item + tip → re-rularea nu creează dubluri.
 */
export function deriveAlerts(
  item: { id: string; titlu: string; sursa: string; storyId?: string },
  a: LocalAnalysis,
  now: string
): MonitorAlert[] {
  if (a.relevance < LOCAL_RELEVANCE_MIN) return [];
  const alerts: MonitorAlert[] = [];
  const base = {
    workspace: "valcea" as Workspace,
    sourceName: item.sursa,
    itemId: item.id,
    ...(item.storyId ? { storyId: item.storyId } : {}),
    institutions: a.institutions,
    at: now,
    status: "new" as const,
  };
  if (a.alertType) {
    alerts.push({
      ...base,
      id: `${item.id}-${a.alertType}`,
      type: a.alertType,
      severity: severityFor(a.urgency, a.alertType),
      title: ALERT_TYPE_LABELS[a.alertType],
      message: item.titlu,
      ...(a.suggestion ? { suggestion: a.suggestion } : {}),
    });
  }
  if (a.publicInterest >= 80 && a.alertType !== "public-interest") {
    alerts.push({
      ...base,
      id: `${item.id}-public-interest`,
      type: "public-interest",
      severity: severityFor(a.urgency, "public-interest"),
      title: ALERT_TYPE_LABELS["public-interest"],
      message: item.titlu,
    });
  }
  return alerts;
}

/* ── Etichetarea pe workspace-uri ──────────────────────────── */

/**
 * Workspace-urile unui semnal: toate semnalele sunt naționale; „valcea"
 * se adaugă când textul atinge cuvintele-cheie locale sau sursa e
 * asignată workspace-ului.
 */
export function itemWorkspaces(
  matchedKeywords: string[],
  sourceWorkspace?: Workspace
): Workspace[] {
  const ws: Workspace[] = ["national"];
  if (matchedKeywords.length > 0 || sourceWorkspace === "valcea") {
    ws.push("valcea");
  }
  return ws;
}

/* ── Filtrarea entităților pe workspace ────────────────────── */

/**
 * O entitate aparține lentilei Vâlcea dacă numele/aliasurile ei ating
 * cuvintele-cheie locale sau dacă apare împreună (co-ocurență) cu
 * entitățile-nucleu ale județului. Reutilizează datele Entity Engine.
 */
export function isLocalEntity(
  e: Pick<Entity, "name" | "aliases" | "relatedEntityIds">,
  cfg: WorkspaceConfig,
  coreEntityIds: Set<string>
): boolean {
  const names = [e.name, ...e.aliases].join(" | ");
  if (matchKeywords(names, cfg.keywords).length > 0) return true;
  return e.relatedEntityIds.some((id) => coreEntityIds.has(id));
}

/** Entitățile-nucleu ale județului: județul, reședința + instituțiile. */
export function coreValceaEntityIds(cfg: WorkspaceConfig): Set<string> {
  return new Set([
    entityId("Vâlcea", "county"),
    entityId("Râmnicu Vâlcea", "city"),
    ...cfg.institutions.map((i) => i.entityId),
  ]);
}

/* ══ Source Coverage: acoperirea multi-sursă a workspace-ului ══
 *
 * Monitorul e SOURCE-NEUTRAL: nicio publicație locală nu e tratată ca
 * autoritate editorială. Fiecare story important arată câte surse
 * independente îl susțin și de ce fel (oficiale / presă / sociale).
 */

export type SourceCategory =
  | "local-press"
  | "county-institutions"
  | "city-halls"
  | "emergency"
  | "health"
  | "utilities"
  | "companies"
  | "eu-funds"
  | "facebook-pages"
  | "facebook-groups"
  | "youtube-channels"
  | "websites-no-rss"
  | "national-relevant";

export const SOURCE_CATEGORIES: SourceCategory[] = [
  "local-press",
  "county-institutions",
  "city-halls",
  "emergency",
  "health",
  "utilities",
  "companies",
  "eu-funds",
  "facebook-pages",
  "facebook-groups",
  "youtube-channels",
  "websites-no-rss",
  "national-relevant",
];

export const SOURCE_CATEGORY_LABELS: Record<SourceCategory, string> = {
  "local-press": "Presă locală",
  "county-institutions": "Instituții județene",
  "city-halls": "Primării și comune",
  emergency: "Servicii de urgență",
  health: "Instituții de sănătate",
  utilities: "Utilități publice",
  companies: "Companii și angajatori",
  "eu-funds": "Fonduri UE și achiziții publice",
  "facebook-pages": "Pagini Facebook publice",
  "facebook-groups": "Grupuri Facebook publice",
  "youtube-channels": "Canale YouTube",
  "websites-no-rss": "Site-uri fără RSS",
  "national-relevant": "Surse naționale relevante",
};

/** Clasa unei surse: oficială (primară), editorială (presă) sau socială. */
export type SourceClass = "official" | "editorial" | "social";

export const SOURCE_CLASS_LABELS: Record<SourceClass, string> = {
  official: "Oficială",
  editorial: "Presă",
  social: "Socială",
};

export function sourceClassOf(category: SourceCategory | undefined): SourceClass {
  switch (category) {
    case "county-institutions":
    case "city-halls":
    case "emergency":
    case "health":
    case "utilities":
    case "companies":
    case "eu-funds":
      return "official";
    case "facebook-pages":
    case "facebook-groups":
    case "youtube-channels":
      return "social";
    default:
      return "editorial";
  }
}

/** Localitățile principale ale județului — pentru analiza lacunelor. */
export const VALCEA_LOCALITIES: string[] = [
  "Râmnicu Vâlcea",
  "Drăgășani",
  "Horezu",
  "Brezoi",
  "Călimănești",
  "Băile Olănești",
  "Băile Govora",
  "Ocnele Mari",
  "Voineasa",
];

/* ── Acoperirea unui Story (source-neutrality) ─────────────── */

/** Câmpurile minime ale unei surse necesare clasificării. */
export interface SourceLike {
  name: string;
  sourceCategory?: SourceCategory;
  kind?: SourceKind;
}

export interface StoryCoverage {
  /** Numărul de surse independente (nume unice) */
  independentSources: number;
  officialCount: number;
  pressCount: number;
  socialCount: number;
  /** ≥ 2 surse independente */
  corroborated: boolean;
  /** O singură publicație → „Sursă unică — necesită verificare" */
  singleSource: boolean;
  /** 0-100: numărul și diversitatea claselor de surse */
  diversityScore: number;
}

/**
 * Calculează acoperirea unui story din lista lui de surse (nume unice) și
 * registrul de surse. Sursele necunoscute registrului contează ca presă.
 */
export function computeStoryCoverage(
  storySources: string[],
  registry: SourceLike[]
): StoryCoverage {
  const byName = new Map(registry.map((s) => [normalizeAlias(s.name), s]));
  const unique = [...new Set(storySources.map((s) => s.trim()).filter(Boolean))];
  let official = 0;
  let press = 0;
  let social = 0;
  for (const name of unique) {
    const src = byName.get(normalizeAlias(name));
    const cls = src ? sourceClassOf(src.sourceCategory) : "editorial";
    if (cls === "official") official++;
    else if (cls === "social") social++;
    else press++;
  }
  const n = unique.length;
  const classes = [official, press, social].filter((c) => c > 0).length;
  const diversityScore = Math.min(
    100,
    Math.min(60, n * 20) + Math.max(0, classes - 1) * 20
  );
  return {
    independentSources: n,
    officialCount: official,
    pressCount: press,
    socialCount: social,
    corroborated: n >= 2,
    singleSource: n <= 1,
    diversityScore,
  };
}

export const SINGLE_SOURCE_LABEL = "Sursă unică — necesită verificare";

/** Starea documentului story_coverage scris de pipeline. */
export interface StoryCoverageDoc extends StoryCoverage {
  storyId: string;
  workspace: Workspace;
  /** unchecked = fără analiză AI încă; consistent/conflicting = verificat */
  conflict: "unchecked" | "consistent" | "conflicting";
  conflictNote?: string;
  updatedAt: string;
}

/* ── Lacune de acoperire ───────────────────────────────────── */

export interface CoverageGaps {
  /** Categoriile fără nicio sursă activă */
  emptyCategories: SourceCategory[];
  /** Instituțiile monitorizate fără nicio sursă asociată */
  institutionsWithoutSource: string[];
  /** Localitățile fără nicio sursă asignată */
  localitiesWithoutSource: string[];
}

export function computeCoverageGaps(
  sources: {
    name: string;
    enabled: boolean;
    sourceCategory?: SourceCategory;
    locality?: string;
    notes?: string;
  }[],
  cfg: WorkspaceConfig
): CoverageGaps {
  const active = sources.filter((s) => s.enabled);
  const emptyCategories = SOURCE_CATEGORIES.filter(
    (c) => !active.some((s) => s.sourceCategory === c)
  );
  const institutionsWithoutSource = cfg.institutions
    .filter(
      (inst) =>
        !active.some(
          (s) =>
            matchKeywords(`${s.name} ${s.notes ?? ""}`, [
              inst.name,
              ...inst.aliases,
            ]).length > 0
        )
    )
    .map((i) => i.name);
  const localitiesWithoutSource = VALCEA_LOCALITIES.filter(
    (loc) =>
      !active.some(
        (s) =>
          (s.locality && normalizeAlias(s.locality) === normalizeAlias(loc)) ||
          matchKeywords(s.name, [loc]).length > 0
      )
  );
  return { emptyCategories, institutionsWithoutSource, localitiesWithoutSource };
}

/* ── Lista de start Vâlcea — DOAR URL-uri verificate real ──── */

export interface StarterSource {
  name: string;
  /** Gol = URL-ul oficial trebuie completat manual (nu inventăm) */
  url: string;
  kind: SourceKind;
  sourceCategory: SourceCategory;
  locality?: string;
  notes: string;
}

/**
 * Catalogul de start al workspace-ului Vâlcea. Fiecare URL de mai jos a
 * fost VERIFICAT (răspunde, iar feed-urile sunt RSS valid) înainte de a fi
 * inclus; feed-urile se re-validează la activare. Intrările fără URL sunt
 * de completat manual — nu inventăm adrese. Nicio publicație nu e
 * autoritate: catalogul acoperă presă + oficial + social, iar lista rămâne
 * complet configurabilă din Source Center.
 */
export const VALCEA_STARTER_SOURCES: StarterSource[] = [
  /* Presă locală — feed-uri RSS verificate. Surse egale între ele. */
  { name: "Ziarul de Vâlcea", url: "https://www.ziaruldevalcea.ro/feed", kind: "rss", sourceCategory: "local-press", locality: "Râmnicu Vâlcea", notes: "Feed RSS verificat." },
  { name: "Curierul de Vâlcea", url: "https://www.curierul.ro/feed", kind: "rss", sourceCategory: "local-press", locality: "Râmnicu Vâlcea", notes: "Feed RSS verificat." },
  { name: "Gazeta Vâlceană", url: "https://www.gazetavalceana.ro/feed", kind: "rss", sourceCategory: "local-press", locality: "Râmnicu Vâlcea", notes: "Feed RSS verificat." },
  { name: "Vâlcea News", url: "https://valceanews.ro/feed", kind: "rss", sourceCategory: "local-press", locality: "Râmnicu Vâlcea", notes: "Feed RSS verificat." },

  /* Instituții județene */
  { name: "Consiliul Județean Vâlcea", url: "https://www.cjvalcea.ro/feed", kind: "institution", sourceCategory: "county-institutions", locality: "Râmnicu Vâlcea", notes: "Feed RSS oficial verificat (cjvalcea.ro)." },
  { name: "Prefectura Vâlcea", url: "https://vl.prefectura.mai.gov.ro", kind: "website", sourceCategory: "county-institutions", locality: "Râmnicu Vâlcea", notes: "Site oficial fără RSS — necesită conector." },

  /* Primării */
  { name: "Primăria Râmnicu Vâlcea", url: "https://www.primariavl.ro", kind: "website", sourceCategory: "city-halls", locality: "Râmnicu Vâlcea", notes: "Site oficial fără RSS — necesită conector." },
  { name: "Primăria Drăgășani", url: "https://www.primariadragasani.ro", kind: "website", sourceCategory: "city-halls", locality: "Drăgășani", notes: "Site oficial fără RSS — necesită conector." },
  { name: "Primăria Horezu", url: "https://www.orasul-horezu.ro", kind: "website", sourceCategory: "city-halls", locality: "Horezu", notes: "Site oficial fără RSS — necesită conector." },
  { name: "Primăria Brezoi", url: "https://www.primariabrezoi.ro", kind: "website", sourceCategory: "city-halls", locality: "Brezoi", notes: "Site oficial fără RSS — necesită conector." },
  { name: "Primăria Călimănești", url: "https://primaria-calimanesti.ro", kind: "website", sourceCategory: "city-halls", locality: "Călimănești", notes: "Site oficial fără RSS — necesită conector." },
  { name: "Primăria Băile Olănești", url: "https://primariabaileolanesti.ro/feed", kind: "institution", sourceCategory: "city-halls", locality: "Băile Olănești", notes: "Feed RSS oficial verificat." },
  { name: "Primăria Voineasa", url: "https://primariavoineasa.ro/feed", kind: "institution", sourceCategory: "city-halls", locality: "Voineasa", notes: "Feed RSS oficial verificat." },
  { name: "Primăria Băile Govora", url: "", kind: "website", sourceCategory: "city-halls", locality: "Băile Govora", notes: "URL oficial de completat — nu a putut fi verificat." },
  { name: "Primăria Ocnele Mari", url: "", kind: "website", sourceCategory: "city-halls", locality: "Ocnele Mari", notes: "URL oficial de completat — nu a putut fi verificat." },

  /* Urgențe și ordine publică */
  { name: "ISU Vâlcea", url: "https://isuvl.ro", kind: "website", sourceCategory: "emergency", locality: "Râmnicu Vâlcea", notes: "Site oficial fără RSS — necesită conector." },
  { name: "IPJ Vâlcea", url: "https://vl.politiaromana.ro", kind: "website", sourceCategory: "emergency", locality: "Râmnicu Vâlcea", notes: "Site oficial fără RSS — necesită conector." },

  /* Sănătate */
  { name: "Spitalul Județean de Urgență Vâlcea", url: "https://www.sjv.ro/feed", kind: "institution", sourceCategory: "health", locality: "Râmnicu Vâlcea", notes: "Feed RSS oficial verificat (sjv.ro)." },
  { name: "DSP Vâlcea", url: "", kind: "website", sourceCategory: "health", locality: "Râmnicu Vâlcea", notes: "URL oficial de completat — nu a putut fi verificat." },

  /* Utilități și companii */
  { name: "Apavil", url: "https://apavil.ro", kind: "website", sourceCategory: "utilities", locality: "Râmnicu Vâlcea", notes: "Site oficial fără RSS — necesită conector." },
  { name: "CET Govora", url: "https://www.cetgovora.ro", kind: "website", sourceCategory: "utilities", locality: "Băile Govora", notes: "Site oficial fără RSS — necesită conector." },

  /* Social — fără URL-uri inventate; se completează cu paginile oficiale */
  { name: "Facebook: Consiliul Județean Vâlcea", url: "", kind: "facebook", sourceCategory: "facebook-pages", locality: "Râmnicu Vâlcea", notes: "URL-ul paginii oficiale de completat. Necesită conector (API oficial) — fără scraping." },
  { name: "Facebook: Primăria Râmnicu Vâlcea", url: "", kind: "facebook", sourceCategory: "facebook-pages", locality: "Râmnicu Vâlcea", notes: "URL-ul paginii oficiale de completat. Necesită conector (API oficial) — fără scraping." },
  { name: "Facebook: ISU Vâlcea", url: "", kind: "facebook", sourceCategory: "facebook-pages", locality: "Râmnicu Vâlcea", notes: "URL-ul paginii oficiale de completat. Necesită conector (API oficial) — fără scraping." },
  { name: "Facebook: IPJ Vâlcea", url: "", kind: "facebook", sourceCategory: "facebook-pages", locality: "Râmnicu Vâlcea", notes: "URL-ul paginii oficiale de completat. Necesită conector (API oficial) — fără scraping." },
];
