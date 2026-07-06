import { NextResponse } from "next/server";

import { generateCoachBrief } from "@/server/ai/briefClient";
import { handleAIRoute } from "@/server/ai/aiRoute";

export const maxDuration = 60;

export async function POST(request: Request) {
  return handleAIRoute(
    request,
    {
      rateLimitKey: "ai-brief",
      rateLimitedError: "Too many briefing requests. Please slow down for a moment.",
      notConfiguredError: "AI briefing isn't configured.",
      unavailableError: "Couldn't generate a briefing right now."
    },
    async (body) => {
      // `JSON.parse("null")` succeeds, so guard before property access.
      const facts = (body && typeof body === "object" ? body : {}) as {
        timeOfDay?: unknown;
        heroName?: unknown;
        allClear?: unknown;
        items?: unknown;
        aboutMe?: unknown;
      };

      const items = Array.isArray(facts.items)
        ? facts.items.filter((item): item is string => typeof item === "string").slice(0, 8)
        : [];

      const message = await generateCoachBrief({
        timeOfDay: typeof facts.timeOfDay === "string" ? facts.timeOfDay : "day",
        heroName: typeof facts.heroName === "string" ? facts.heroName.slice(0, 48) : undefined,
        allClear: facts.allClear === true,
        items,
        aboutMe: typeof facts.aboutMe === "string" ? facts.aboutMe.slice(0, 2000) : undefined
      });
      return NextResponse.json({ message });
    }
  );
}
