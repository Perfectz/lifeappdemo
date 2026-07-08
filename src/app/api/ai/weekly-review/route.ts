import { NextResponse } from "next/server";

import { isWeeklyReview, isWeeklyReviewNarrative } from "@/domain/weeklyReview";
import { handleAIRoute } from "@/server/ai/aiRoute";
import { suggestWeeklyReview } from "@/server/ai/weeklyReviewClient";

export const maxDuration = 30;

const MAX_TEXT_CHARS = 6_000;

export async function POST(request: Request) {
  return handleAIRoute(
    request,
    {
      rateLimitKey: "ai-weekly-review",
      rateLimitedError: "Too many weekly review requests. Try again shortly.",
      notConfiguredError: "AI weekly reviews aren't configured. Add an OpenAI API key to enable them.",
      unavailableError: "Couldn't personalize the week in review right now."
    },
    async (body) => {
      const r = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
      // Strict ISO date — this string is interpolated into the AI prompt, so it
      // must not become an unbounded free-text channel that bypasses the clamps.
      const weekStart =
        typeof r.weekStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.weekStart) ? r.weekStart : "";

      if (!weekStart) {
        return NextResponse.json(
          { error: "A valid weekStart (YYYY-MM-DD) is required." },
          { status: 400 }
        );
      }
      // The deterministic review + narrative are the ground truth the AI is
      // clamped to — a request without valid ones has nothing safe to rewrite.
      if (!isWeeklyReview(r.review)) {
        return NextResponse.json({ error: "A valid weekly review is required." }, { status: 400 });
      }
      if (!isWeeklyReviewNarrative(r.deterministic)) {
        return NextResponse.json(
          { error: "A valid deterministic narrative is required." },
          { status: 400 }
        );
      }

      const profileContext =
        typeof r.profileContext === "string" && r.profileContext.trim()
          ? r.profileContext.slice(0, MAX_TEXT_CHARS)
          : undefined;

      const narrative = await suggestWeeklyReview({
        weekStart,
        review: r.review,
        deterministic: r.deterministic,
        profileContext
      });
      return NextResponse.json(narrative);
    }
  );
}
