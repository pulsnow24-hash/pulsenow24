import type { InboxScoredItem, InboxPriority } from "@/lib/ai-types";

export type InboxStatus = "new" | "approved" | "rejected" | "drafted";

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  laquo: "«",
  raquo: "»",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
};

/** Decodează entitățile HTML (numerice și numite) din titluri/descrieri RSS. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
      String.fromCodePoint(parseInt(h, 16))
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => NAMED_ENTITIES[n] ?? m);
}

/** Documentul stocat în Firestore (colecția "inbox"). */
export interface InboxDoc extends InboxScoredItem {
  id: string;
  status: InboxStatus;
  addedAt: string;
  /** Story-ul (evenimentul) căruia îi aparține semnalul */
  storyId?: string;
  /** Workspace-urile cărora le aparține semnalul (implicit național) */
  workspaces?: import("@/lib/engine/workspace").Workspace[];
  /** Analiza de inteligență locală (doar semnalele relevante local) */
  local?: import("@/lib/engine/workspace").LocalAnalysis;
}

/** Normalizează un document brut (inclusiv formatul vechi) la forma curentă. */
export function normalizeInboxDoc(
  id: string,
  d: Record<string, unknown>
): InboxDoc {
  const num = (v: unknown, fallback: number): number =>
    typeof v === "number" ? v : fallback;
  const str = (v: unknown, fallback: string): string =>
    typeof v === "string" && v ? v : fallback;

  const importance = num(d.importanceScore, num(d.scor, 0));
  const priority: InboxPriority =
    (d.priority as InboxPriority) ??
    (importance >= 90
      ? "breaking"
      : importance >= 70
        ? "high"
        : importance >= 40
          ? "normal"
          : "low");

  const legacyStatus: Record<string, InboxStatus> = {
    nou: "new",
    respins: "rejected",
    procesat: "drafted",
  };
  const rawStatus = str(d.status, "new");
  const status: InboxStatus =
    (["new", "approved", "rejected", "drafted"].includes(rawStatus)
      ? (rawStatus as InboxStatus)
      : legacyStatus[rawStatus]) ?? "new";

  return {
    id,
    titlu: decodeEntities(str(d.titlu, "(fără titlu)")),
    link: str(d.link, ""),
    sursa: str(d.sursa, "Sursă"),
    descriere: decodeEntities(str(d.descriere, "")),
    publicatLa: str(d.publicatLa, ""),
    importanceScore: importance,
    trustScore: num(d.trustScore, 60),
    viralScore: num(d.viralScore, 50),
    seoScore: num(d.seoScore, 50),
    fakeNewsRisk: num(d.fakeNewsRisk, 10),
    categorie: str(d.categorie, "Actualitate"),
    countryCode: str(d.countryCode, "RO").toUpperCase().slice(0, 2),
    priority,
    readingTime: num(d.readingTime, 3),
    isDuplicate: d.isDuplicate === true,
    keep: d.keep !== false,
    reason: str(d.reason, str(d.motiv, "")),
    status,
    addedAt: str(d.addedAt, str(d.adaugatLa, new Date().toISOString())),
    ...(typeof d.storyId === "string" && d.storyId ? { storyId: d.storyId } : {}),
    ...(Array.isArray(d.workspaces)
      ? { workspaces: d.workspaces as InboxDoc["workspaces"] }
      : {}),
    ...(d.local && typeof d.local === "object"
      ? { local: d.local as InboxDoc["local"] }
      : {}),
  };
}

export interface PriorityMeta {
  label: string;
  /** clasa text (ex: text-red-500) */
  text: string;
  /** clasa fundal subtil */
  bg: string;
  /** clasa bară de accent (fundal solid) */
  bar: string;
  border: string;
}

export function priorityMeta(p: InboxPriority): PriorityMeta {
  switch (p) {
    case "breaking":
      return {
        label: "Breaking",
        text: "text-red-500",
        bg: "bg-red-500/10",
        bar: "bg-red-500",
        border: "border-red-500/30",
      };
    case "high":
      return {
        label: "Prioritate",
        text: "text-amber-500",
        bg: "bg-amber-500/10",
        bar: "bg-amber-500",
        border: "border-amber-500/30",
      };
    case "normal":
      return {
        label: "Normal",
        text: "text-blue-500",
        bg: "bg-blue-500/10",
        bar: "bg-blue-500",
        border: "border-blue-500/30",
      };
    default:
      return {
        label: "Minor",
        text: "text-zinc-500",
        bg: "bg-zinc-500/10",
        bar: "bg-zinc-600",
        border: "border-zinc-500/30",
      };
  }
}

/** Culoarea unui scor 0-100 (verde ridicat → roșu scăzut). */
export function scoreColor(v: number): string {
  if (v >= 75) return "text-emerald-400";
  if (v >= 50) return "text-blue-400";
  if (v >= 30) return "text-amber-400";
  return "text-zinc-500";
}

/** Risc de fake news: invers — mare = roșu. */
export function riskColor(v: number): string {
  if (v >= 60) return "text-red-500";
  if (v >= 30) return "text-amber-400";
  return "text-emerald-400";
}

export function domainOf(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function faviconUrl(link: string): string {
  const domain = domainOf(link);
  return domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
    : "";
}

const COUNTRY_NAMES: Record<string, string> = {
  RO: "România",
  US: "SUA",
  GB: "Marea Britanie",
  FR: "Franța",
  DE: "Germania",
  IT: "Italia",
  ES: "Spania",
  UA: "Ucraina",
  RU: "Rusia",
  MD: "Moldova",
  PL: "Polonia",
  CN: "China",
  IL: "Israel",
  TR: "Turcia",
  EU: "Uniunea Europeană",
  XX: "Global",
};

export function countryName(code: string): string {
  return COUNTRY_NAMES[code] ?? code;
}

export function countryFlag(code: string): string {
  if (code === "XX") return "🌍";
  if (!/^[A-Z]{2}$/.test(code)) return "🏳️";
  return String.fromCodePoint(
    ...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

/** Timp relativ compact în română: „acum", „5m", „3h", „ieri", „12 iul". */
export function relativeTime(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "acum";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ieri";
  if (d < 7) return `${d}z`;
  return new Date(then).toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "short",
  });
}
