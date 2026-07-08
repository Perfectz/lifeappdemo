import { NextResponse } from "next/server";

import { isNutritionAdvice } from "@/domain/nutritionAdvice";
import { handleAIRoute } from "@/server/ai/aiRoute";
import { suggestDailyNutritionAdvice } from "@/server/ai/nutritionAdviceClient";

export const maxDuration = 30;

const MAX_TEXT_CHARS = 6_000;

export async function POST(request: Request) {
  return handleAIRoute(
    request,
    {
      rateLimitKey: "ai-nutrition-advice",
      rateLimitedError: "Too many advice requests. Try again shortly.",
      notConfiguredError: "AI advice isn't configured. Add an OpenAI API key to enable it.",
      unavailableError: "Couldn't personalize today's advice right now."
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
      // The deterministic advice is the ground truth the AI is clamped to — a
      // request without a valid one has nothing safe to rewrite.
      if (!isNutritionAdvice(r.deterministic)) {
        return NextResponse.json(
          { error: "Valid deterministic advice is required." },
          { status: 400 }
        );
      }

      const clampText = (value: unknown): string | undefined =>
        typeof value === "string" && value.trim() ? value.slice(0, MAX_TEXT_CHARS) : undefined;

      const advice = await suggestDailyNutritionAdvice({
        date,
        deterministic: r.deterministic,
        diarySummary: clampText(r.diarySummary),
        profileContext: clampText(r.profileContext),
        memoryContext: clampText(r.memoryContext)
      });
      return NextResponse.json(advice);
    }
  );
}
