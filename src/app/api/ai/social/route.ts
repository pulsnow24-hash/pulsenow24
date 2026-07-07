import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/server/auth";
import { generateSocial } from "@/lib/server/ai";

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
  let body: {
    titlu?: string;
    sumar?: string;
    fapt?: string;
    opinie?: string;
    dezbatere?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cerere invalidă" }, { status: 400 });
  }
  if (!body.titlu?.trim()) {
    return NextResponse.json(
      { error: "Articolul nu are titlu — completează formularul întâi" },
      { status: 400 }
    );
  }

  try {
    const posts = await generateSocial({
      titlu: body.titlu ?? "",
      sumar: body.sumar ?? "",
      fapt: body.fapt ?? "",
      opinie: body.opinie ?? "",
      dezbatere: body.dezbatere ?? "",
    });
    return NextResponse.json(posts);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Eroare necunoscută";
    const status = message.includes("ANTHROPIC_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
