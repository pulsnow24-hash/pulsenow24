/**
 * News Platform Engine — modelul surselor RSS și al automatizării.
 *
 * Publication-agnostic: tipurile și regulile de mai jos sunt reutilizabile de
 * orice instanță (CryptoNow24, SportNow24, Valcea24…). Doar DEFAULT_SOURCES
 * ține valori specifice PulsNow24, folosite o singură dată la inițializare.
 */

export type SourceStatus = "healthy" | "degraded" | "down" | "unknown";

export interface RssSource {
  id: string;
  name: string;
  url: string;
  category: string;
  countryCode: string;
  language?: string;
  /** Tipul de conector (implicit "rss"); vezi engine/workspace.ts */
  kind?: import("./workspace").SourceKind;
  /** Workspace-ul căruia îi e asignată sursa (implicit "national") */
  workspace?: import("./workspace").Workspace;
  /** Categoria instituțională (presă locală, primării, urgențe…) */
  sourceCategory?: import("./workspace").SourceCategory;
  /** Localitatea acoperită de sursă */
  locality?: string;
  /** Afiliere politică/instituțională, DOAR dacă e cunoscută public */
  affiliation?: string;
  /** Note editoriale despre sursă */
  notes?: string;
  trusted: boolean;
  blocked: boolean;
  enabled: boolean;
  /** 1 (minor) … 5 (prioritate maximă) */
  priority: number;
  /** Interval propriu de refresh în minute; 0 = folosește intervalul global */
  refreshInterval: number;
  status: SourceStatus;
  lastSync?: string;
  /** Timp de răspuns la ultima sincronizare, în ms */
  responseTime?: number;
  /** Scor de sănătate 0-100 (uptime + viteză) */
  healthScore?: number;
  articlesToday?: number;
  /** yyyy-mm-dd — pentru resetarea zilnică a contorului */
  articlesTodayDate?: string;
  failCount?: number;
  lastError?: string;
  addedAt: string;
}

/** Rezultatul unei sincronizări pentru o sursă (întors de server). */
export interface SourceSyncResult {
  id: string;
  itemCount: number;
  responseTime: number;
  language?: string;
  error?: string;
}

export interface ImportError {
  source: string;
  message: string;
}

export interface ImportLog {
  id: string;
  at: string;
  durationMs: number;
  sourcesChecked: number;
  itemsFound: number;
  itemsAdded: number;
  autoApproved: number;
  errors: ImportError[];
  trigger: "manual" | "auto";
  /** Durata fiecărei faze (ms) — diagnostic: care pas a durat sau a fost întrerupt */
  phaseMs?: Record<string, number>;
}

export interface AutomationConfig {
  autoRefresh: boolean;
  intervalMinutes: number;
  /** Rate limiting: câte articole noi se pot adăuga într-o rulare */
  maxPerRun: number;
  rules: {
    /** Aprobă automat în inbox articolele care trec pragurile */
    autoApprove: {
      enabled: boolean;
      minImportance: number;
      minTrust: number;
      trustedOnly: boolean;
    };
    /** Marchează breaking articolele peste prag (AI decide, regula filtrează) */
    breaking: { enabled: boolean; minImportance: number };
    /** Semnalează candidații pentru draft automat (nu generează singur) */
    autoDraft: { enabled: boolean; minImportance: number; trustedOnly: boolean };
  };
}

export const DEFAULT_AUTOMATION: AutomationConfig = {
  autoRefresh: false,
  intervalMinutes: 30,
  maxPerRun: 40,
  rules: {
    autoApprove: {
      enabled: false,
      minImportance: 80,
      minTrust: 75,
      trustedOnly: true,
    },
    breaking: { enabled: true, minImportance: 90 },
    autoDraft: { enabled: false, minImportance: 85, trustedOnly: true },
  },
};

/** Sursele implicite PulsNow24 — inserate o singură dată la prima rulare. */
export const DEFAULT_SOURCES: Pick<
  RssSource,
  "id" | "name" | "url" | "category" | "countryCode"
>[] = [
  { id: "digi24", name: "Digi24", url: "https://www.digi24.ro/rss", category: "Actualitate", countryCode: "RO" },
  { id: "hotnews", name: "HotNews", url: "https://hotnews.ro/feed", category: "Actualitate", countryCode: "RO" },
  { id: "g4media", name: "G4Media", url: "https://www.g4media.ro/feed", category: "Politică", countryCode: "RO" },
  { id: "biziday", name: "Biziday", url: "https://www.biziday.ro/feed/", category: "Actualitate", countryCode: "RO" },
];

export function newSource(
  partial: Partial<RssSource> & Pick<RssSource, "name" | "url">
): Omit<RssSource, "id"> {
  // Firestore respinge valorile undefined, așa că nu includem câmpuri goale.
  const base: Omit<RssSource, "id"> = {
    name: partial.name,
    url: partial.url,
    category: partial.category ?? "Actualitate",
    countryCode: (partial.countryCode ?? "RO").toUpperCase().slice(0, 2),
    trusted: partial.trusted ?? false,
    blocked: partial.blocked ?? false,
    enabled: partial.enabled ?? true,
    priority: partial.priority ?? 3,
    refreshInterval: partial.refreshInterval ?? 0,
    status: partial.status ?? "unknown",
    addedAt: partial.addedAt ?? new Date().toISOString(),
  };
  if (partial.language) base.language = partial.language;
  if (partial.kind) base.kind = partial.kind;
  if (partial.workspace) base.workspace = partial.workspace;
  if (partial.sourceCategory) base.sourceCategory = partial.sourceCategory;
  if (partial.locality) base.locality = partial.locality;
  if (partial.affiliation) base.affiliation = partial.affiliation;
  if (partial.notes) base.notes = partial.notes;
  return base;
}

/** Recalculează starea de sănătate a unei surse după o sincronizare. */
export function applyHealth(
  source: RssSource,
  result: SourceSyncResult
): Partial<RssSource> {
  const today = new Date().toISOString().slice(0, 10);
  const failed = !!result.error;
  const failCount = failed ? (source.failCount ?? 0) + 1 : 0;

  let status: SourceStatus;
  if (failed) status = failCount >= 3 ? "down" : "degraded";
  else if (result.responseTime > 4000) status = "degraded";
  else status = "healthy";

  // Scor: pornim de la 100, penalizăm eșecurile și latența mare
  let healthScore = 100;
  if (failed) healthScore = Math.max(0, 60 - failCount * 20);
  else healthScore = Math.max(40, 100 - Math.round(result.responseTime / 120));

  const sameDay = source.articlesTodayDate === today;
  const articlesToday = failed
    ? (sameDay ? source.articlesToday ?? 0 : 0)
    : (sameDay ? (source.articlesToday ?? 0) : 0) + result.itemCount;

  const patch: Partial<RssSource> = {
    status,
    healthScore,
    responseTime: result.responseTime,
    lastSync: new Date().toISOString(),
    failCount,
    articlesToday,
    articlesTodayDate: today,
    lastError: result.error ?? "",
  };
  const lang = result.language ?? source.language;
  if (lang) patch.language = lang;
  return patch;
}

/** Scorul de încredere derivat: trusted + sănătate, penalizat de eșecuri. */
export function trustScore(source: RssSource): number {
  let score = source.trusted ? 85 : 60;
  score += Math.round(((source.healthScore ?? 60) - 60) / 4);
  score -= (source.failCount ?? 0) * 5;
  return Math.max(0, Math.min(100, score));
}

export function statusMeta(status: SourceStatus): {
  label: string;
  dot: string;
  text: string;
} {
  switch (status) {
    case "healthy":
      return { label: "Activ", dot: "bg-emerald-500", text: "text-emerald-400" };
    case "degraded":
      return { label: "Lent", dot: "bg-amber-500", text: "text-amber-400" };
    case "down":
      return { label: "Picat", dot: "bg-red-500", text: "text-red-500" };
    default:
      return { label: "Nesincronizat", dot: "bg-zinc-600", text: "text-muted-foreground" };
  }
}

/** Sursa e „due" pentru refresh față de intervalul ei (sau cel global)? */
export function isDue(source: RssSource, globalMinutes: number): boolean {
  if (!source.enabled || source.blocked) return false;
  if (!source.lastSync) return true;
  const interval = (source.refreshInterval || globalMinutes) * 60000;
  return Date.now() - new Date(source.lastSync).getTime() >= interval;
}
