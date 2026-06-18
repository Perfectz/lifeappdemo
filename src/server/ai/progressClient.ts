import { COACH_MODEL } from "@/config/ai";
import { parseProgressAssessment, type ProgressAssessment } from "@/domain/progressAssessment";
import { progressPhotoAngleLabel, type ProgressPhotoAngle } from "@/domain/progressPhotos";
import { AINotConfiguredError, buildOpenAIError, chatCompletionBody } from "@/server/ai/openaiClient";

export type ProgressImage = {
  angle: ProgressPhotoAngle;
  dataUrl: string;
};

export type ProgressAssessmentInput = {
  images: ProgressImage[];
  /** The user's stated future-self / health goal, for grounding the read. */
  goalContext?: string;
};

export type ProgressAssessmentRun = (input: ProgressAssessmentInput) => Promise<ProgressAssessment>;

let testRun: ProgressAssessmentRun | undefined;

export function setProgressAssessmentForTests(run: ProgressAssessmentRun | undefined) {
  testRun = run;
}

const SYSTEM_PROMPT = [
  "You are a supportive, honest fitness coach assessing a person's physique-progress photos against their stated goal.",
  "You will receive 1–3 photos (some of: front, side profile, face close-up) and the user's goal.",
  "Give a grounded, encouraging read of where they appear to be relative to the goal. Be motivating but truthful — do not flatter.",
  "Comment only on what is visible (posture, apparent leanness/muscle, face). Never claim to diagnose anything or give medical advice.",
  "If you offer a body-fat figure, frame it as a rough visual range only, never a precise or clinical number.",
  'Respond ONLY with strict JSON: {"summary": string, "alignment": "on_track"|"needs_work"|"unclear", "observations": string[], "encouragement": string, "estimatedBodyFatRange"?: string}.',
  "Use alignment 'unclear' if the photos are too dark/cropped/ambiguous to judge, and say what photo would help.",
  "Keep observations concrete and actionable (2–5 items). Keep encouragement to one or two sentences."
].join(" ");

function intFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function assessProgressPhotos(
  input: ProgressAssessmentInput
): Promise<ProgressAssessment> {
  if (testRun) {
    return testRun(input);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AINotConfiguredError();
  }

  const maxTokens = intFromEnv("OPENAI_MAX_TOKENS", 800);
  const timeoutMs = intFromEnv("OPENAI_TIMEOUT_MS", 30_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const goalText = input.goalContext?.trim()
    ? `The user's goal / future-self vision:\n${input.goalContext.trim()}`
    : "The user wants to get leaner, healthier, and more athletic.";
  const angleList = input.images
    .map((image) => progressPhotoAngleLabel[image.angle])
    .join(", ");

  const userContent: Array<
    { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
  > = [
    { type: "text", text: `${goalText}\n\nPhotos provided: ${angleList}. Assess progress toward the goal.` },
    ...input.images.map(
      (image) => ({ type: "image_url" as const, image_url: { url: image.dataUrl } })
    )
  ];

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(
        chatCompletionBody({
          model: COACH_MODEL,
          maxCompletionTokens: maxTokens,
          temperature: 0.4,
          responseFormat: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userContent }
          ]
        })
      )
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Progress assessment timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw await buildOpenAIError(response, "Progress assessment");
  }

  const payload: unknown = await response.json();
  const content =
    payload &&
    typeof payload === "object" &&
    "choices" in payload &&
    Array.isArray((payload as { choices?: unknown[] }).choices)
      ? (((payload as { choices: { message?: { content?: unknown } }[] }).choices[0]?.message
          ?.content) ?? "")
      : "";

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Progress assessment was empty.");
  }

  try {
    return parseProgressAssessment(JSON.parse(content));
  } catch {
    throw new Error("Progress assessment was not valid JSON.");
  }
}
