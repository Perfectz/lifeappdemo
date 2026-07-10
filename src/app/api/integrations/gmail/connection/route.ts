import { NextResponse } from "next/server";

import { requireUser } from "@/server/auth/requireUser";
import { disconnectGmail } from "@/server/integrations/gmail";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  try {
    await disconnectGmail(auth.user.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not disconnect Gmail right now." }, { status: 502 });
  }
}
