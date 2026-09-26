import { NextResponse } from "next/server";

import { handleAIRoute } from "@/server/ai/aiRoute";
import { createLiveSession, validateLiveSessionRequest } from "@/server/ai/liveClient";

export const maxDuration = 30;

/**
 * Creates a GPT-Live voice session (WebRTC) for a signed-in, approved member.
 * The device sends its SDP offer + app context + locally executable tools; the
 * response carries only the SDP answer (the API key never leaves the server).
 */
export async function POST(request: Request) {
  return handleAIRoute(
    request,
    {
      rateLimitKey: "live-session",
      rateLimitedError: "Too many voice sessions. Please wait a moment and try again.",
      notConfiguredError: "Live voice isn't configured. Add an OpenAI API key to enable it.",
      unavailableError: "Live voice is unavailable right now."
    },
    async (body) => {
      const validation = validateLiveSessionRequest(body);
      if (!validation.ok) {
        return NextResponse.json({ error: validation.message }, { status: 400 });
      }
      const session = await createLiveSession(validation.value);
      return NextResponse.json(session);
    }
  );
}
