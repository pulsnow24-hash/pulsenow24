import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/server/auth";
import { analyzeLocalItems } from "@/lib/server/ai";

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
  let body: {
    items?: { titlu?: string; descriere?: string }[];
    region?: string;
    institutions?: string[];
  };
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
  const region = body.region?.trim() || "județul Vâlcea";
  const institutions = (body.institutions ?? []).filter(
    (n): n is string => typeof n === "string" && n.trim().length > 0
  );

  try {
    const result = await analyzeLocalItems(items, { region, institutions });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Eroare necunoscută";
    const status = message.includes("ANTHROPIC_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
