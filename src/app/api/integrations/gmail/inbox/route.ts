import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/requireUser";
import { GmailNotConnectedError, getGmailInboxDigest } from "@/server/integrations/gmail";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  try {
    return NextResponse.json(await getGmailInboxDigest(auth.user.id));
  } catch (error) {
    if (error instanceof GmailNotConnectedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not read Gmail right now." }, { status: 502 });
  }
}
