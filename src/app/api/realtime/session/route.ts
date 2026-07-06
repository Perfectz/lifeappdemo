import { NextResponse } from "next/server";

import { validateRealtimeSessionRequestBody } from "@/domain/voiceSessions";
import { handleAIRoute } from "@/server/ai/aiRoute";
import { createRealtimeClientSecret } from "@/server/ai/realtimeClient";

export async function POST(request: Request) {
  // Each session mints a live 10-minute realtime-voice credential — the most
  // expensive OpenAI product in the app — so it gets the full guard: signed-in
  // user required, then per-user throttling like every other route.
  return handleAIRoute(
    request,
    {
      rateLimitKey: "realtime-session",
      rateLimitedError: "Too many voice session requests. Please slow down for a moment.",
      notConfiguredError: "Voice sessions aren't configured. Add an OpenAI API key to enable them.",
      unavailableError: "Realtime voice session is unavailable right now."
    },
    async (body) => {
      const validation = validateRealtimeSessionRequestBody(body);

      if (!validation.ok) {
        return NextResponse.json({ error: validation.message }, { status: 400 });
      }

      const session = await createRealtimeClientSecret({ mode: validation.value.mode });

      return NextResponse.json(session);
    }
  );
}
