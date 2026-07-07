import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/server/auth";
import { generateArticle } from "@/lib/server/ai";

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
  let body: { url?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cerere invalidă" }, { status: 400 });
  }
  if (!body.url?.trim() && !body.text?.trim()) {
    return NextResponse.json(
      { error: "Trimite un URL sau un text" },
      { status: 400 }
    );
  }

  try {
    const articol = await generateArticle({
      url: body.url?.trim() || undefined,
      text: body.text?.trim() || undefined,
    });
    return NextResponse.json(articol);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Eroare necunoscută";
    const status = message.includes("ANTHROPIC_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
