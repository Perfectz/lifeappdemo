import { NextResponse } from "next/server";

import { handleAIRoute } from "@/server/ai/aiRoute";
import { suggestDailyWorkoutPlan } from "@/server/ai/workoutCoachClient";

export const maxDuration = 45;

const MAX_TEXT_CHARS = 6_000;

export async function POST(request: Request) {
  return handleAIRoute(
    request,
    {
      rateLimitKey: "ai-workout-suggestion",
      rateLimitedError: "Too many workout requests. Try again shortly.",
      notConfiguredError: "AI workouts aren't configured. Add an OpenAI API key to enable them.",
      unavailableError: "Couldn't pick today's workout right now."
    },
    async (body) => {
      const r = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
      // Strict ISO date — this string is interpolated into the AI prompt, so it
      // must not become an unbounded free-text channel that bypasses the clamps.
      const date = typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : "";
      if (!date) {
        return NextResponse.json(
          { error: "A valid date (YYYY-MM-DD) is required." },
          { status: 400 }
        );
      }

      const clampText = (value: unknown): string | undefined =>
        typeof value === "string" && value.trim() ? value.slice(0, MAX_TEXT_CHARS) : undefined;

      const plan = await suggestDailyWorkoutPlan({
        date,
        historySummary: clampText(r.historySummary),
        memorySummary: clampText(r.memorySummary),
        readiness: clampText(r.readiness),
        goal: clampText(r.goal)
      });
      return NextResponse.json(plan);
    }
  );
}
