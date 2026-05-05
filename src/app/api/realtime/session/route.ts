import { NextResponse } from "next/server";

import { validateRealtimeSessionRequestBody } from "@/domain/voiceSessions";
import { createRealtimeClientSecret } from "@/server/ai/realtimeClient";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const validation = validateRealtimeSessionRequestBody(body);

  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }

  try {
    const session = await createRealtimeClientSecret({ mode: validation.value.mode });

    return NextResponse.json(session);
  } catch {
    return NextResponse.json(
      { error: "Realtime voice session is unavailable right now." },
      { status: 502 }
    );
  }
}
