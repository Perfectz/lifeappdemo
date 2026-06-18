import { NextResponse } from "next/server";

import { isProgressPhotoAngle } from "@/domain/progressPhotos";
import { AINotConfiguredError } from "@/server/ai/openaiClient";
import { assessProgressPhotos, type ProgressImage } from "@/server/ai/progressClient";
import { checkRateLimit } from "@/server/ai/rateLimiter";

// Multi-image vision can take several seconds; allow more than the Hobby default.
export const maxDuration = 60;

const MAX_IMAGE_CHARS = 8_000_000; // ~6 MB per image as a base64 data URL
const MAX_IMAGES = 3;

export async function POST(request: Request) {
  const limit = checkRateLimit("ai-progress");
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many assessment requests. Please slow down for a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const rawImages = (body as { images?: unknown })?.images;
  const goalContext = (body as { goalContext?: unknown })?.goalContext;

  if (!Array.isArray(rawImages) || rawImages.length === 0) {
    return NextResponse.json({ error: "At least one photo is required." }, { status: 400 });
  }
  if (rawImages.length > MAX_IMAGES) {
    return NextResponse.json({ error: "Send at most three photos." }, { status: 400 });
  }

  const images: ProgressImage[] = [];
  for (const raw of rawImages) {
    const angle = (raw as { angle?: unknown })?.angle;
    const dataUrl = (raw as { dataUrl?: unknown })?.dataUrl;
    if (!isProgressPhotoAngle(angle)) {
      return NextResponse.json({ error: "A photo angle is invalid." }, { status: 400 });
    }
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "A valid image is required." }, { status: 400 });
    }
    if (dataUrl.length > MAX_IMAGE_CHARS) {
      return NextResponse.json(
        { error: "A photo is too large — try a smaller image." },
        { status: 413 }
      );
    }
    images.push({ angle, dataUrl });
  }

  try {
    const result = await assessProgressPhotos({
      images,
      goalContext: typeof goalContext === "string" ? goalContext.slice(0, 4_000) : undefined
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AINotConfiguredError) {
      return NextResponse.json(
        { error: "Progress assessment isn't configured. Add an OpenAI API key to enable it." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Couldn't assess your photos right now. Try again in a moment." },
      { status: 502 }
    );
  }
}
