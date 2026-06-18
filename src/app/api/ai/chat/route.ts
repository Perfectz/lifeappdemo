import { NextResponse } from "next/server";

import {
  buildAIAppContext,
  formatAIContextForPrompt,
  summarizeAIAppContext,
  validateAIChatRequestBody
} from "@/domain/aiContext";
import { toLocalIsoDate } from "@/domain/dates";
import { AINotConfiguredError, completeReadOnlyCoachChat } from "@/server/ai/openaiClient";
import { checkRateLimit } from "@/server/ai/rateLimiter";

// Allow the coach response (OpenAI call) up to 60s on Vercel; the Hobby tier
// default is 10s, which would cut off the in-code 30s OpenAI timeout.
export const maxDuration = 60;

export async function POST(request: Request) {
  const limit = checkRateLimit("ai-chat");
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many AI requests. Please slow down for a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const validation = validateAIChatRequestBody(body);

  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }

  const context = buildAIAppContext(validation.value.appData ?? {}, toLocalIsoDate());
  const usedContext = summarizeAIAppContext(context);

  try {
    const contextText = formatAIContextForPrompt(context);
    const fullContext = validation.value.aboutMe
      ? `About the user (their self-profile):\n${validation.value.aboutMe}\n\n${contextText}`
      : contextText;

    const completion = await completeReadOnlyCoachChat({
      message: validation.value.message,
      mode: validation.value.mode,
      context: fullContext,
      heroName: validation.value.heroName
    });

    return NextResponse.json({
      message: completion.message,
      mode: validation.value.mode,
      proposals: completion.proposals,
      usedContext
    });
  } catch (error) {
    if (error instanceof AINotConfiguredError) {
      return NextResponse.json(
        {
          error:
            "AI coach isn't configured. The deterministic app works fully without it — add an OpenAI API key to enable coaching."
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      {
        error: "AI coach is unavailable right now. Try again in a moment."
      },
      { status: 502 }
    );
  }
}
