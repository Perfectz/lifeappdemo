import { NextResponse } from "next/server";

import { AINotConfiguredError, OpenAIRequestError } from "@/server/ai/openaiClient";
import { checkRateLimit } from "@/server/ai/rateLimiter";
import { suggestDailyWorkoutPlan } from "@/server/ai/workoutCoachClient";

export const maxDuration = 45;

const MAX_TEXT_CHARS = 6_000;

export async function POST(request: Request) {
  const limit = checkRateLimit("ai-workout-suggestion");
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many workout requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const r = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const date = typeof r.date === "string" ? r.date : "";
  if (!date) {
    return NextResponse.json({ error: "A date is required." }, { status: 400 });
  }

  const clampText = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim() ? value.slice(0, MAX_TEXT_CHARS) : undefined;

  try {
    const plan = await suggestDailyWorkoutPlan({
      date,
      historySummary: clampText(r.historySummary),
      memorySummary: clampText(r.memorySummary),
      readiness: clampText(r.readiness),
      goal: clampText(r.goal)
    });
    return NextResponse.json(plan);
  } catch (error) {
    if (error instanceof AINotConfiguredError) {
      return NextResponse.json(
        { error: "AI workouts aren't configured. Add an OpenAI API key to enable them." },
        { status: 503 }
      );
    }
    if (error instanceof OpenAIRequestError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status === 429 ? 429 : 502 }
      );
    }
    return NextResponse.json(
      { error: "Couldn't pick today's workout right now." },
      { status: 502 }
    );
  }
}
