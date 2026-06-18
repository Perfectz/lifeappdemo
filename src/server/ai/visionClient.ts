import { COACH_MODEL } from "@/config/ai";
import { parseVisionResult, type VisionResult } from "@/domain/visionUpdates";
import { AINotConfiguredError, buildOpenAIError, chatCompletionBody } from "@/server/ai/openaiClient";

export type VisionExtractionInput = {
  /** A data URL (data:image/...;base64,....). */
  imageDataUrl: string;
  /** Optional user note/correction to refine the read. */
  context?: string;
};

export type VisionExtraction = (input: VisionExtractionInput) => Promise<VisionResult>;

let testExtraction: VisionExtraction | undefined;

export function setVisionExtractionForTests(extraction: VisionExtraction | undefined) {
  testExtraction = extraction;
}

const SYSTEM_PROMPT = [
  "You extract loggable data from a photo or screenshot for a personal fitness/life app, then propose updates.",
  "Look at the image (e.g. a steps/walking screenshot, treadmill or watch summary, blood-pressure monitor, a meal, a whiteboard note).",
  "Map what you see onto these tools, returning one proposal per distinct update:",
  "- log_metric: { checkInType?, steps?, sleepHours?, energyLevel? (1-5), moodLevel? (1-5), weightLbs?, bloodPressureSystolic?, bloodPressureDiastolic?, bloodGlucoseMgDl? }",
  "- log_cardio: { activity: walk|run|jog|ddr|bike-vest, minutes?, distanceMiles?, weightVestLbs? }",
  "- log_strength: { day: 1-5, variant?: Free Weight|Machine|Kettlebell }",
  "- log_martial_arts: { session: bas-beginner|bas-advanced|shidokan-kickboxing|shidokan-karate, minutes? }",
  "- create_quest: { title, priority?, tags? }",
  "- add_journal_entry: { content }",
  'Respond ONLY with strict JSON: {"summary": string, "confidence": "high"|"medium"|"low", "question"?: string, "proposals": [{"tool": string, "args": object, "label": string}]}.',
  "Set confidence to low or medium and include a short clarifying question whenever the image is ambiguous or a number is unclear.",
  "Never invent values you cannot see. Prefer asking over guessing. Use the user's note to refine if provided.",
  "label is a short human description of the change, e.g. 'Log 8,240 steps'."
].join(" ");

function intFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function extractUpdatesFromImage(
  input: VisionExtractionInput
): Promise<VisionResult> {
  if (testExtraction) {
    return testExtraction(input);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AINotConfiguredError();
  }

  const maxTokens = intFromEnv("OPENAI_MAX_TOKENS", 800);
  const timeoutMs = intFromEnv("OPENAI_TIMEOUT_MS", 30_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const userText = input.context?.trim()
    ? `The user added this detail/correction: "${input.context.trim()}". Use it to refine your read.`
    : "Extract any loggable data from this image.";

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
          temperature: 0.2,
          responseFormat: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                { type: "text", text: userText },
                { type: "image_url", image_url: { url: input.imageDataUrl } }
              ]
            }
          ]
        })
      )
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Vision request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw await buildOpenAIError(response, "Vision request");
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
    throw new Error("Vision response was empty.");
  }

  try {
    return parseVisionResult(JSON.parse(content));
  } catch {
    throw new Error("Vision response was not valid JSON.");
  }
}
