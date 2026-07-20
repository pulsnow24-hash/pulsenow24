import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/server/auth";
import { checkStoryMerge, type MergePairInput } from "@/lib/server/ai";

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
  let body: { pairs?: MergePairInput[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cerere invalidă" }, { status: 400 });
  }
  const pairs = (body.pairs ?? []).filter(
    (p) => p?.a?.title?.trim() && p?.b?.title?.trim()
  );
  if (pairs.length === 0) {
    return NextResponse.json({ error: "Lipsesc perechile" }, { status: 400 });
  }
  try {
    const result = await checkStoryMerge(pairs);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Eroare necunoscută";
    const status = message.includes("ANTHROPIC_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
