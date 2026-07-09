import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/server/auth";
import { fetchFeed } from "@/lib/server/rss";

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cerere invalidă" }, { status: 400 });
  }
  const url = body.url?.trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "URL invalid" }, { status: 400 });
  }

  const result = await fetchFeed(url, 5);
  if (result.error) {
    return NextResponse.json(
      { valid: false, error: result.error, responseTime: result.responseTime },
      { status: 200 }
    );
  }
  if (result.items.length === 0) {
    return NextResponse.json(
      {
        valid: false,
        error: "Feed accesibil, dar fără articole detectabile.",
        responseTime: result.responseTime,
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    valid: true,
    responseTime: result.responseTime,
    language: result.language,
    feedTitle: result.feedTitle,
    sample: result.items.slice(0, 4).map((i) => i.titlu),
    itemCount: result.items.length,
  });
}
