import { NextResponse } from "next/server";

import { AINotConfiguredError, OpenAIRequestError } from "@/server/ai/openaiClient";
import { extractUpdatesFromImage } from "@/server/ai/visionClient";
import { checkRateLimit } from "@/server/ai/rateLimiter";

// Vision can take a few seconds; allow more than the Hobby default.
export const maxDuration = 60;

const MAX_IMAGE_CHARS = 8_000_000; // ~6 MB image as a base64 data URL

export async function POST(request: Request) {
  const limit = checkRateLimit("ai-vision");
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many image requests. Please slow down for a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const image = (body as { image?: unknown })?.image;
  const context = (body as { context?: unknown })?.context;

  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return NextResponse.json({ error: "A valid image is required." }, { status: 400 });
  }
  if (image.length > MAX_IMAGE_CHARS) {
    return NextResponse.json({ error: "That image is too large — try a smaller photo." }, { status: 413 });
  }

  try {
    const result = await extractUpdatesFromImage({
      imageDataUrl: image,
      context: typeof context === "string" ? context.slice(0, 1_000) : undefined
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AINotConfiguredError) {
      return NextResponse.json(
        { error: "Image analysis isn't configured. Add an OpenAI API key to enable it." },
        { status: 503 }
      );
    }
    if (error instanceof OpenAIRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status === 429 ? 429 : 502 });
    }
    return NextResponse.json(
      { error: "Couldn't analyze that image right now. Try again in a moment." },
      { status: 502 }
    );
  }
}
