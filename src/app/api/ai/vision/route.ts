import { NextResponse } from "next/server";

import { extractUpdatesFromImage } from "@/server/ai/visionClient";
import { handleAIRoute } from "@/server/ai/aiRoute";

// Vision can take a few seconds; allow more than the Hobby default.
export const maxDuration = 60;

const MAX_IMAGE_CHARS = 8_000_000; // ~6 MB image as a base64 data URL

export async function POST(request: Request) {
  return handleAIRoute(
    request,
    {
      rateLimitKey: "ai-vision",
      rateLimitedError: "Too many image requests. Please slow down for a moment.",
      notConfiguredError: "Image analysis isn't configured. Add an OpenAI API key to enable it.",
      unavailableError: "Couldn't analyze that image right now. Try again in a moment."
    },
    async (body) => {
      const image = (body as { image?: unknown })?.image;
      const context = (body as { context?: unknown })?.context;

      if (typeof image !== "string" || !image.startsWith("data:image/")) {
        return NextResponse.json({ error: "A valid image is required." }, { status: 400 });
      }
      if (image.length > MAX_IMAGE_CHARS) {
        return NextResponse.json(
          { error: "That image is too large — try a smaller photo." },
          { status: 413 }
        );
      }

      const result = await extractUpdatesFromImage({
        imageDataUrl: image,
        context: typeof context === "string" ? context.slice(0, 1_000) : undefined
      });
      return NextResponse.json(result);
    }
  );
}
