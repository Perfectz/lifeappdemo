import { NextResponse } from "next/server";

import type { TargetBaseline } from "@/domain/dailyNutritionTarget";
import { AINotConfiguredError, OpenAIRequestError } from "@/server/ai/openaiClient";
import { checkRateLimit } from "@/server/ai/rateLimiter";
import { suggestDailyNutritionTarget } from "@/server/ai/nutritionTargetClient";

export const maxDuration = 30;

const MAX_TEXT_CHARS = 6_000;

function posNum(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export async function POST(request: Request) {
  const limit = checkRateLimit("ai-nutrition-target");
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many target requests. Try again shortly." },
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
  const baselineRaw = (r.baseline && typeof r.baseline === "object" ? r.baseline : {}) as Record<
    string,
    unknown
  >;

  if (!date) {
    return NextResponse.json({ error: "A date is required." }, { status: 400 });
  }
  if (
    !posNum(baselineRaw.recommendedCalories) ||
    !posNum(baselineRaw.minCalories) ||
    typeof baselineRaw.proteinTargetG !== "number" ||
    typeof baselineRaw.carbsTargetG !== "number" ||
    typeof baselineRaw.fatTargetG !== "number"
  ) {
    return NextResponse.json({ error: "A valid baseline is required." }, { status: 400 });
  }

  const baseline: TargetBaseline = {
    recommendedCalories: baselineRaw.recommendedCalories,
    proteinTargetG: baselineRaw.proteinTargetG,
    carbsTargetG: baselineRaw.carbsTargetG,
    fatTargetG: baselineRaw.fatTargetG,
    minCalories: baselineRaw.minCalories
  };

  const goal = r.goal === "lose" ? "lose" : "maintain";
  const clampText = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim() ? value.slice(0, MAX_TEXT_CHARS) : undefined;

  try {
    const target = await suggestDailyNutritionTarget({
      date,
      baseline,
      goal,
      profileContext: clampText(r.profileContext),
      metricsSummary: clampText(r.metricsSummary)
    });
    return NextResponse.json(target);
  } catch (error) {
    if (error instanceof AINotConfiguredError) {
      return NextResponse.json(
        { error: "AI targets aren't configured. Add an OpenAI API key to enable them." },
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
      { error: "Couldn't compute today's target right now." },
      { status: 502 }
    );
  }
}
