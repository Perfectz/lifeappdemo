import { NextResponse } from "next/server";

import { estimateMealFromPhoto } from "@/server/ai/mealClient";
import { handleAIRoute } from "@/server/ai/aiRoute";

// Vision can take several seconds; allow more than the Hobby default.
export const maxDuration = 60;

const MAX_IMAGE_CHARS = 8_000_000; // ~6 MB image as a base64 data URL

export async function POST(request: Request) {
  return handleAIRoute(
    request,
    {
      rateLimitKey: "ai-meal",
      rateLimitedError: "Too many meal photos. Please slow down for a moment.",
      notConfiguredError: "Meal photo estimates aren't configured. Add an OpenAI API key to enable it.",
      unavailableError: "Couldn't read that meal photo right now. Try again in a moment."
    },
    async (body) => {
      const image = (body as { image?: unknown })?.image;
      const note = (body as { note?: unknown })?.note;

      if (typeof image !== "string" || !image.startsWith("data:image/")) {
        return NextResponse.json({ error: "A valid meal photo is required." }, { status: 400 });
      }
      if (image.length > MAX_IMAGE_CHARS) {
        return NextResponse.json(
          { error: "That photo is too large — try a smaller image." },
          { status: 413 }
        );
      }

      const result = await estimateMealFromPhoto({
        imageDataUrl: image,
        note: typeof note === "string" ? note.slice(0, 500) : undefined
      });
      return NextResponse.json(result);
    }
  );
}
