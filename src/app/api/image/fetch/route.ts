import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/server/auth";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Proxy pentru importul imaginilor din surse externe: browserul nu poate
 * descărca imagini cross-origin, așa că serverul o aduce, iar clientul
 * o urcă apoi în Firebase Storage.
 */
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
    return NextResponse.json({ error: "URL de imagine invalid" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Sursa a răspuns cu HTTP ${res.status}` },
        { status: 502 }
      );
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: `URL-ul nu e o imagine (${contentType || "tip necunoscut"})` },
        { status: 415 }
      );
    }
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json(
        { error: "Imaginea depășește 10 MB" },
        { status: 413 }
      );
    }
    return new Response(bytes, {
      headers: { "Content-Type": contentType },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Eroare necunoscută";
    return NextResponse.json(
      { error: `Nu am putut descărca imaginea: ${message}` },
      { status: 502 }
    );
  }
}
