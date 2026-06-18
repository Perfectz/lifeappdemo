import { NextResponse } from "next/server";

import { AINotConfiguredError, OpenAIRequestError } from "@/server/ai/openaiClient";
import { generateCoachBrief } from "@/server/ai/briefClient";
import { checkRateLimit } from "@/server/ai/rateLimiter";

export const maxDuration = 60;

export async function POST(request: Request) {
  const limit = checkRateLimit("ai-brief");
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many briefing requests. Please slow down for a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const facts = body as {
    timeOfDay?: unknown;
    heroName?: unknown;
    allClear?: unknown;
    items?: unknown;
  };

  const items = Array.isArray(facts.items)
    ? facts.items.filter((item): item is string => typeof item === "string").slice(0, 8)
    : [];

  try {
    const message = await generateCoachBrief({
      timeOfDay: typeof facts.timeOfDay === "string" ? facts.timeOfDay : "day",
      heroName: typeof facts.heroName === "string" ? facts.heroName.slice(0, 48) : undefined,
      allClear: facts.allClear === true,
      items
    });
    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof AINotConfiguredError) {
      return NextResponse.json(
        { error: "AI briefing isn't configured." },
        { status: 503 }
      );
    }
    if (error instanceof OpenAIRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status === 429 ? 429 : 502 });
    }
    return NextResponse.json(
      { error: "Couldn't generate a briefing right now." },
      { status: 502 }
    );
  }
}
