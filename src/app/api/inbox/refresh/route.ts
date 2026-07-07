import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { isAuthorized } from "@/lib/server/auth";
import { scoreNewsItems, type RawNewsItem } from "@/lib/server/ai";

const FEEDS = [
  { nume: "Digi24", url: "https://www.digi24.ro/rss" },
  { nume: "HotNews", url: "https://hotnews.ro/feed" },
  { nume: "G4Media", url: "https://www.g4media.ro/feed" },
  { nume: "Biziday", url: "https://www.biziday.ro/feed/" },
];

const MAX_PER_FEED = 8;

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

interface RssItem {
  title?: string | { "#text"?: string };
  link?: string | { "@_href"?: string };
  description?: string;
  pubDate?: string;
  published?: string;
}

function itemText(v: RssItem["title"]): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "#text" in v) return v["#text"] ?? "";
  return "";
}

async function fetchFeed(feed: { nume: string; url: string }): Promise<RawNewsItem[]> {
  const res = await fetch(feed.url, {
    headers: { "User-Agent": "PulsNow24 RSS Reader" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`${feed.nume}: HTTP ${res.status}`);
  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);
  const items = asArray<RssItem>(
    parsed.rss?.channel?.item ?? parsed.feed?.entry
  );

  return items.slice(0, MAX_PER_FEED).flatMap((item) => {
    const titlu = stripHtml(itemText(item.title));
    const link =
      typeof item.link === "string"
        ? item.link
        : (item.link?.["@_href"] ?? "");
    if (!titlu || !link) return [];
    const pubDate = item.pubDate ?? item.published ?? "";
    const parsedDate = pubDate ? new Date(pubDate) : null;
    return [
      {
        titlu,
        link: link.trim(),
        sursa: feed.nume,
        descriere: stripHtml(item.description ?? "").slice(0, 300),
        publicatLa:
          parsedDate && !isNaN(parsedDate.getTime())
            ? parsedDate.toISOString()
            : new Date().toISOString(),
      },
    ];
  });
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  const rawItems = results.flatMap((r) =>
    r.status === "fulfilled" ? r.value : []
  );
  const feedErrors = results.flatMap((r) =>
    r.status === "rejected" ? [String(r.reason?.message ?? r.reason)] : []
  );

  if (rawItems.length === 0) {
    return NextResponse.json(
      { error: `Niciun flux RSS nu a răspuns. ${feedErrors.join("; ")}` },
      { status: 502 }
    );
  }

  try {
    const items = await scoreNewsItems(rawItems);
    return NextResponse.json({ items, feedErrors });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Eroare necunoscută";
    const status = message.includes("ANTHROPIC_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
