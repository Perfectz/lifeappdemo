import { NextResponse } from "next/server";

import { isPoseType, isReferenceImageRole } from "@/domain/timelineMirror";
import { AINotConfiguredError, OpenAIRequestError } from "@/server/ai/openaiClient";
import { checkRateLimit } from "@/server/ai/rateLimiter";
import {
  assessTimelineMirror,
  type TimelineMirrorInput,
  type TimelineReferenceInput
} from "@/server/ai/timelineMirrorClient";

// Multi-image vision + reasoning can take several seconds; allow more than the
// Hobby default, matching the progress-assessment route.
export const maxDuration = 60;

const MAX_IMAGE_CHARS = 8_000_000; // ~6 MB per image as a base64 data URL
const MAX_REFERENCES = 9; // 3 roles × 3 useful poses
const MAX_TEXT_CHARS = 8_000;

function isImageDataUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:image/");
}

export async function POST(request: Request) {
  const limit = checkRateLimit("ai-timeline-mirror");
  if (!limit.ok) {
    return NextResponse.json(
      { error: "The Mirror Crystal needs a moment to cool. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const record = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  // --- uploaded photo (required) ---
  const currentPhotoRaw = record.currentPhoto as Record<string, unknown> | undefined;
  const currentDataUrl = currentPhotoRaw?.dataUrl;
  if (!isImageDataUrl(currentDataUrl)) {
    return NextResponse.json({ error: "A checkpoint photo is required." }, { status: 400 });
  }
  if (currentDataUrl.length > MAX_IMAGE_CHARS) {
    return NextResponse.json(
      { error: "That photo is too large — try a smaller image." },
      { status: 413 }
    );
  }
  const poseHint = isPoseType(currentPhotoRaw?.poseType)
    ? currentPhotoRaw?.poseType
    : isPoseType(currentPhotoRaw?.poseHint)
      ? currentPhotoRaw?.poseHint
      : undefined;

  // --- references (optional) ---
  const references: TimelineReferenceInput[] = [];
  const rawReferences = record.references;
  if (rawReferences !== undefined) {
    if (!Array.isArray(rawReferences)) {
      return NextResponse.json({ error: "References must be a list." }, { status: 400 });
    }
    if (rawReferences.length > MAX_REFERENCES) {
      return NextResponse.json(
        { error: `Send at most ${MAX_REFERENCES} reference images.` },
        { status: 400 }
      );
    }
    for (const raw of rawReferences) {
      const ref = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      if (!isReferenceImageRole(ref.role)) {
        return NextResponse.json({ error: "A reference role is invalid." }, { status: 400 });
      }
      if (!isImageDataUrl(ref.dataUrl)) {
        return NextResponse.json({ error: "A reference image is invalid." }, { status: 400 });
      }
      if ((ref.dataUrl as string).length > MAX_IMAGE_CHARS) {
        return NextResponse.json(
          { error: "A reference image is too large — try a smaller image." },
          { status: 413 }
        );
      }
      references.push({
        role: ref.role,
        poseType: isPoseType(ref.poseType) ? ref.poseType : "unknown",
        dataUrl: ref.dataUrl as string
      });
    }
  }

  const clampText = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim() ? value.slice(0, MAX_TEXT_CHARS) : undefined;

  const input: TimelineMirrorInput = {
    currentPhoto: { dataUrl: currentDataUrl, poseHint },
    references,
    idealMarkdown: clampText(record.idealMarkdown),
    warningMarkdown: clampText(record.warningMarkdown),
    profileContext: clampText(record.profileContext),
    lifeDataSummary: clampText(record.lifeDataSummary)
  };

  try {
    const result = await assessTimelineMirror(input);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AINotConfiguredError) {
      return NextResponse.json(
        { error: "Timeline Mirror isn't configured. Add an OpenAI API key to enable it." },
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
      { error: "The Mirror Crystal went cloudy. Try again in a moment." },
      { status: 502 }
    );
  }
}
