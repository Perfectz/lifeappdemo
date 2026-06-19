import { NextResponse } from "next/server";

import { AINotConfiguredError, OpenAIRequestError } from "@/server/ai/openaiClient";
import { estimateMealFromPhoto } from "@/server/ai/mealClient";
import { checkRateLimit } from "@/server/ai/rateLimiter";

// Vision can take several seconds; allow more than the Hobby default.
export const maxDuration = 60;

const MAX_IMAGE_CHARS = 8_000_000; // ~6 MB image as a base64 data URL

export async function POST(request: Request) {
  const limit = checkRateLimit("ai-meal");
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many meal photos. Please slow down for a moment." },
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
  const note = (body as { note?: unknown })?.note;

  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return NextResponse.json({ error: "A valid meal photo is required." }, { status: 400 });
  }
  if (image.length > MAX_IMAGE_CHARS) {
    return NextResponse.json({ error: "That photo is too large — try a smaller image." }, { status: 413 });
  }

  try {
    const result = await estimateMealFromPhoto({
      imageDataUrl: image,
      note: typeof note === "string" ? note.slice(0, 500) : undefined
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AINotConfiguredError) {
      return NextResponse.json(
        { error: "Meal photo estimates aren't configured. Add an OpenAI API key to enable it." },
        { status: 503 }
      );
    }
    if (error instanceof OpenAIRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status === 429 ? 429 : 502 });
    }
    return NextResponse.json(
      { error: "Couldn't read that meal photo right now. Try again in a moment." },
      { status: 502 }
    );
  }
}
