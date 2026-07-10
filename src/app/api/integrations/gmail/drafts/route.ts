import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/requireUser";
import { GmailNotConnectedError, createGmailDraft } from "@/server/integrations/gmail";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }
  const value = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const input = {
    to: typeof value.to === "string" ? value.to : "",
    subject: typeof value.subject === "string" ? value.subject : "",
    body: typeof value.body === "string" ? value.body : ""
  };
  try {
    const draft = await createGmailDraft(auth.user.id, input);
    return NextResponse.json({ ok: true, draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create the Gmail draft.";
    const status = error instanceof GmailNotConnectedError ? 409 : /required|valid|under/i.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
