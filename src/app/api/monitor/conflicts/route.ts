import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/server/auth";
import {
  checkStoryConsistency,
  type ConsistencyStoryInput,
} from "@/lib/server/ai";

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
  let body: {
    stories?: {
      title?: string;
      summary?: string;
      entities?: string[];
      signals?: { sursa?: string; titlu?: string; at?: string; descriere?: string }[];
    }[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cerere invalidă" }, { status: 400 });
  }
  const stories: ConsistencyStoryInput[] = (body.stories ?? [])
    .filter((s) => s.title?.trim() && Array.isArray(s.signals) && s.signals.length >= 2)
    .map((s) => ({
      title: s.title!.trim(),
      summary: s.summary?.trim() ?? "",
      entities: (s.entities ?? []).filter(
        (e): e is string => typeof e === "string" && !!e.trim()
      ),
      signals: s.signals!
        .filter((x) => x.titlu?.trim())
        .map((x) => ({
          sursa: x.sursa?.trim() || "Sursă",
          titlu: x.titlu!.trim(),
          at: x.at?.trim() || "",
          ...(x.descriere?.trim() ? { descriere: x.descriere.trim() } : {}),
        })),
    }));
  if (stories.length === 0) {
    return NextResponse.json(
      { error: "Lipsesc story-urile multi-sursă" },
      { status: 400 }
    );
  }

  try {
    const result = await checkStoryConsistency(stories);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Eroare necunoscută";
    const status = message.includes("ANTHROPIC_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
