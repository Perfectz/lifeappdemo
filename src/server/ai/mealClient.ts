import { COACH_MODEL } from "@/config/ai";
import { parseMealEstimate, type MealEstimate } from "@/domain/mealEstimate";
import { AINotConfiguredError, buildOpenAIError, chatCompletionBody } from "@/server/ai/openaiClient";

export type MealEstimateInput = {
  /** A data URL (data:image/...;base64,....). */
  imageDataUrl: string;
  /** Optional note to refine the read (e.g. "the bowl is about 2 cups"). */
  note?: string;
};

export type MealEstimateRun = (input: MealEstimateInput) => Promise<MealEstimate>;

let testRun: MealEstimateRun | undefined;

export function setMealEstimateForTests(run: MealEstimateRun | undefined) {
  testRun = run;
}

const SYSTEM_PROMPT = [
  "You are a nutrition estimator for a food-logging app.",
  "Given a photo of a meal, food, drink, or a nutrition label, identify the distinct food items and estimate the nutrition of each.",
  "Estimate realistic portion sizes from what is visible. Give your best numeric estimate — do not refuse.",
  "Calories are kcal; protein, carbs, fat, and fiber are in grams, per item as shown (not per 100g).",
  'Respond ONLY with strict JSON: {"summary": string, "confidence": "high"|"medium"|"low", "question"?: string, "items": [{"description": string, "calories": number, "proteinG": number, "carbsG": number, "fatG": number, "fiberG": number}]}.',
  "Use confidence 'low' or 'medium' and include a short clarifying question when portions or ingredients are ambiguous.",
  "Only include items you can actually see. Keep each description short (e.g. 'grilled chicken breast', '1 cup white rice')."
].join(" ");

function intFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function estimateMealFromPhoto(input: MealEstimateInput): Promise<MealEstimate> {
  if (testRun) {
    return testRun(input);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AINotConfiguredError();
  }

  const maxTokens = intFromEnv("OPENAI_MAX_TOKENS", 1_000);
  const timeoutMs = intFromEnv("OPENAI_TIMEOUT_MS", 30_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const userText = input.note?.trim()
    ? `Estimate the nutrition of this meal. The user adds: "${input.note.trim()}".`
    : "Estimate the nutrition of this meal.";

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
          temperature: 0.3,
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
      throw new Error("Meal estimate timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw await buildOpenAIError(response, "Meal estimate");
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
    throw new Error("Meal estimate was empty.");
  }

  try {
    return parseMealEstimate(JSON.parse(content));
  } catch {
    throw new Error("Meal estimate was not valid JSON.");
  }
}
