import { NextResponse } from "next/server";

import { handleAIRoute } from "@/server/ai/aiRoute";
import { lookupFlightStatus, validateFlightStatusRequest } from "@/server/ai/flightStatusClient";

export const maxDuration = 60;

/** Live flight status + gate lookup (web search) for a signed-in, approved member. */
export async function POST(request: Request) {
  return handleAIRoute(
    request,
    {
      rateLimitKey: "flight-status",
      rateLimitedError: "Too many flight lookups. Please wait a moment.",
      notConfiguredError: "Flight lookups aren't configured. Add an OpenAI API key to enable them.",
      unavailableError: "Couldn't check that flight right now."
    },
    async (body) => {
      const validation = validateFlightStatusRequest(body);
      if (!validation.ok) {
        return NextResponse.json({ error: validation.message }, { status: 400 });
      }
      return NextResponse.json(await lookupFlightStatus(validation.value));
    }
  );
}
