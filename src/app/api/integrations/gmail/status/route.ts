import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/requireUser";
import { getGmailConnectionStatus } from "@/server/integrations/gmail";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  try {
    return NextResponse.json(await getGmailConnectionStatus(auth.user.id));
  } catch {
    return NextResponse.json({ error: "Could not check Gmail right now." }, { status: 502 });
  }
}
