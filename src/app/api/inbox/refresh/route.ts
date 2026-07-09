import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/server/auth";
import { scoreNewsItems, type RawNewsItem } from "@/lib/server/ai";
import { fetchFeed } from "@/lib/server/rss";
import type { SourceSyncResult } from "@/lib/engine/sources";

/** Sursele trimise de client (din Firestore); fallback la cele implicite. */
interface SourceInput {
  id: string;
  name: string;
  url: string;
}

const FALLBACK: SourceInput[] = [
  { id: "digi24", name: "Digi24", url: "https://www.digi24.ro/rss" },
  { id: "hotnews", name: "HotNews", url: "https://hotnews.ro/feed" },
  { id: "g4media", name: "G4Media", url: "https://www.g4media.ro/feed" },
  { id: "biziday", name: "Biziday", url: "https://www.biziday.ro/feed/" },
];

const MAX_PER_FEED = 8;

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  let sources: SourceInput[] = FALLBACK;
  try {
    const body = (await request.json()) as { sources?: SourceInput[] };
    if (Array.isArray(body.sources) && body.sources.length) {
      sources = body.sources.filter((s) => s.url && s.name);
    }
  } catch {
    /* fără corp — folosim fallback */
  }

  // Descărcăm toate feed-urile în paralel, cu diagnostic per sursă
  const fetched = await Promise.all(
    sources.map(async (source) => {
      const res = await fetchFeed(source.url, MAX_PER_FEED);
      return { source, res };
    })
  );

  const rawItems: RawNewsItem[] = [];
  const perSource: SourceSyncResult[] = [];
  const feedErrors: string[] = [];

  for (const { source, res } of fetched) {
    perSource.push({
      id: source.id,
      itemCount: res.items.length,
      responseTime: res.responseTime,
      language: res.language,
      error: res.error,
    });
    if (res.error) {
      feedErrors.push(`${source.name}: ${res.error}`);
      continue;
    }
    for (const item of res.items) {
      rawItems.push({ ...item, sursa: source.name });
    }
  }

  if (rawItems.length === 0) {
    return NextResponse.json(
      {
        items: [],
        perSource,
        feedErrors,
        error:
          feedErrors.length > 0
            ? `Niciun articol adus. ${feedErrors.slice(0, 3).join("; ")}`
            : "Niciun articol în feed-uri.",
      },
      { status: feedErrors.length ? 502 : 200 }
    );
  }

  try {
    const items = await scoreNewsItems(rawItems);
    return NextResponse.json({ items, perSource, feedErrors });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Eroare necunoscută";
    const status = message.includes("ANTHROPIC_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message, perSource, feedErrors }, { status });
  }
}
