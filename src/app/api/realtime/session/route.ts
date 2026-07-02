import { NextResponse } from "next/server";

import { validateRealtimeSessionRequestBody } from "@/domain/voiceSessions";
import { AINotConfiguredError, OpenAIRequestError } from "@/server/ai/openaiClient";
import { createRealtimeClientSecret } from "@/server/ai/realtimeClient";
import { checkRateLimit } from "@/server/ai/rateLimiter";

export async function POST(request: Request) {
  // Each session mints a live 10-minute realtime-voice credential — the most
  // expensive OpenAI product in the app — so throttle like every other route.
  const limit = checkRateLimit("realtime-session");
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many voice session requests. Please slow down for a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

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
  } catch (error) {
    if (error instanceof AINotConfiguredError) {
      return NextResponse.json(
        { error: "Voice sessions aren't configured. Add an OpenAI API key to enable them." },
        { status: 503 }
      );
    }
    if (error instanceof OpenAIRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status === 429 ? 429 : 502 });
    }
    return NextResponse.json(
      { error: "Realtime voice session is unavailable right now." },
      { status: 502 }
    );
  }
}
