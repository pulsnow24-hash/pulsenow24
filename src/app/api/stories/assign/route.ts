import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/server/auth";
import { assignStoriesToItems } from "@/lib/server/ai";
import type { AssignableItem, StoryCandidate } from "@/lib/ai-types";

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
  let body: { items?: AssignableItem[]; candidates?: StoryCandidate[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cerere invalidă" }, { status: 400 });
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "Lipsesc itemele" }, { status: 400 });
  }

  try {
    const result = await assignStoriesToItems(
      body.items,
      Array.isArray(body.candidates) ? body.candidates : []
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Eroare necunoscută";
    const status = message.includes("ANTHROPIC_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
