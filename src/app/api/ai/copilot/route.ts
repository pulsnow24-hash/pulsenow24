import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/server/auth";
import { runCopilot } from "@/lib/server/copilot";
import type { CopilotRequest } from "@/lib/ai-types";

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
  let body: CopilotRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cerere invalidă" }, { status: 400 });
  }
  if (!body.action || !body.article) {
    return NextResponse.json(
      { error: "Lipsește acțiunea sau contextul articolului" },
      { status: 400 }
    );
  }

  try {
    const result = await runCopilot(body);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Eroare necunoscută";
    const status = message.includes("ANTHROPIC_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
