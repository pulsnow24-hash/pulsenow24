import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/server/auth";
import { generateCommDraft, type CommDraftInput } from "@/lib/server/ai";

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
  let body: Partial<CommDraftInput>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cerere invalidă" }, { status: 400 });
  }
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Lipsește subiectul" }, { status: 400 });
  }
  const input: CommDraftInput = {
    title: body.title.trim(),
    summary: body.summary?.trim() ?? "",
    signals: (body.signals ?? [])
      .filter((s) => s?.titlu?.trim())
      .map((s) => ({ sursa: s.sursa?.trim() || "Sursă", titlu: s.titlu!.trim() })),
    sourceCount: Number(body.sourceCount) || 0,
    officialCount: Number(body.officialCount) || 0,
    confidence: Number(body.confidence) || 0,
    singleSource: !!body.singleSource,
    conflict: body.conflict?.trim() || "unchecked",
  };

  try {
    const result = await generateCommDraft(input);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Eroare necunoscută";
    const status = message.includes("ANTHROPIC_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
