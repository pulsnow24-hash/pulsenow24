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
