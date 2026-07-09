/**
 * Modul RSS reutilizabil: descărcare, parsare, detecție limbă, validare.
 * Folosit de /api/inbox/refresh (import) și /api/sources/validate.
 */
import { XMLParser } from "fast-xml-parser";

export interface RawFeedItem {
  titlu: string;
  link: string;
  descriere: string;
  publicatLa: string;
}

export interface FeedFetchResult {
  items: RawFeedItem[];
  responseTime: number;
  language: string;
  /** Titlul canalului, dacă e disponibil */
  feedTitle?: string;
  error?: string;
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&hellip;/gi, "…")
    .replace(/&(l|r)dquo;/gi, '"')
    .replace(/&(l|r)squo;/gi, "'")
    .replace(/&(m|n)dash;/gi, "—")
    .replace(/\s+/g, " ")
    .trim();
}

interface RssItem {
  title?: string | { "#text"?: string };
  link?: string | { "@_href"?: string } | Array<string | { "@_href"?: string }>;
  description?: string;
  summary?: string;
  content?: string;
  pubDate?: string;
  published?: string;
  updated?: string;
}

function textOf(v: RssItem["title"]): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "#text" in v) return v["#text"] ?? "";
  return "";
}

function linkOf(link: RssItem["link"]): string {
  if (typeof link === "string") return link;
  if (Array.isArray(link)) {
    const alt = link.find((l) => typeof l === "object" && l["@_href"]);
    if (alt && typeof alt === "object") return alt["@_href"] ?? "";
    const first = link[0];
    return typeof first === "string" ? first : (first?.["@_href"] ?? "");
  }
  if (link && typeof link === "object") return link["@_href"] ?? "";
  return "";
}

const RO_WORDS = ["și", "în", "este", "care", "pentru", "după", "președinte", "români", "ministru", "guvern", "această", "fost"];
const EN_WORDS = ["the", "and", "of", "to", "with", "president", "government", "after", "minister", "people"];

/** Detecție de limbă simplă (ro/en/other) pe baza cuvintelor frecvente. */
export function detectLanguage(text: string): string {
  const t = " " + text.toLowerCase() + " ";
  const count = (words: string[]) =>
    words.reduce((n, w) => n + (t.includes(" " + w + " ") ? 1 : 0), 0);
  const ro = count(RO_WORDS) + (/[ăâîșț]/i.test(text) ? 3 : 0);
  const en = count(EN_WORDS);
  if (ro === 0 && en === 0) return "other";
  return ro >= en ? "ro" : "en";
}

export async function fetchFeed(
  url: string,
  limit = 8
): Promise<FeedFetchResult> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "PulsNow24 RSS Reader/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    const responseTime = Date.now() - start;
    if (!res.ok) {
      return { items: [], responseTime, language: "other", error: `HTTP ${res.status}` };
    }
    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xml);
    const channel = parsed.rss?.channel ?? parsed.feed;
    const feedTitle = textOf(channel?.title);
    const rawItems = asArray<RssItem>(channel?.item ?? channel?.entry);

    const items: RawFeedItem[] = rawItems.slice(0, limit).flatMap((item) => {
      const titlu = stripHtml(textOf(item.title));
      const link = linkOf(item.link).trim();
      if (!titlu || !link) return [];
      const pub = item.pubDate ?? item.published ?? item.updated ?? "";
      const parsedDate = pub ? new Date(pub) : null;
      return [
        {
          titlu,
          link,
          descriere: stripHtml(item.description ?? item.summary ?? item.content ?? "").slice(0, 300),
          publicatLa:
            parsedDate && !isNaN(parsedDate.getTime())
              ? parsedDate.toISOString()
              : new Date().toISOString(),
        },
      ];
    });

    const sample = items.slice(0, 4).map((i) => i.titlu + " " + i.descriere).join(" ");
    return {
      items,
      responseTime,
      language: detectLanguage(sample),
      feedTitle: feedTitle || undefined,
    };
  } catch (err) {
    return {
      items: [],
      responseTime: Date.now() - start,
      language: "other",
      error: err instanceof Error ? err.message : "Eroare necunoscută",
    };
  }
}
