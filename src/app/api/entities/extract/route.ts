import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/server/auth";
import { extractEntities } from "@/lib/server/ai";

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
  let body: { items?: { titlu?: string; descriere?: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cerere invalidă" }, { status: 400 });
  }
  const items = (body.items ?? [])
    .filter((i) => i.titlu?.trim())
    .map((i) => ({ titlu: i.titlu!.trim(), descriere: i.descriere?.trim() ?? "" }));
  if (items.length === 0) {
    return NextResponse.json({ error: "Lipsesc itemele" }, { status: 400 });
  }

  try {
    const result = await extractEntities(items);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Eroare necunoscută";
    const status = message.includes("ANTHROPIC_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
