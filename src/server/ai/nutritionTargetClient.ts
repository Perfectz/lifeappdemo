import { COACH_MODEL } from "@/config/ai";
import {
  parseDailyNutritionTarget,
  type DailyNutritionTarget,
  type TargetBaseline
} from "@/domain/dailyNutritionTarget";
import type { IsoDate } from "@/domain/types";
import { AINotConfiguredError, buildOpenAIError, chatCompletionBody } from "@/server/ai/openaiClient";

export type NutritionTargetInput = {
  date: IsoDate;
  baseline: TargetBaseline;
  goal: "lose" | "maintain";
  /** About-me / profile narrative (optional). */
  profileContext?: string;
  /** Recent metrics summary: weight trend, today's training, sleep, adherence. */
  metricsSummary?: string;
};

export type NutritionTargetRun = (input: NutritionTargetInput) => Promise<DailyNutritionTarget>;

let testRun: NutritionTargetRun | undefined;

export function setNutritionTargetForTests(run: NutritionTargetRun | undefined) {
  testRun = run;
}

const SYSTEM_PROMPT = [
  "You are a careful sports-nutrition coach setting TODAY's calorie + macro target for one person.",
  "You are given a deterministic TDEE-based baseline (calories + protein/carbs/fat) and today's signals.",
  "Fine-tune the target for today: nudge calories up on heavy training days and down on full rest days, keep protein high to preserve muscle in a deficit, and account for the weight trend (if weight loss has stalled, a slightly larger deficit is reasonable; if dropping fast, ease off).",
  "Stay close to the baseline — small daily adjustments only. Do NOT make large swings. Never recommend an unsafe or crash-diet target.",
  "This is general fitness guidance, not medical or dietetic advice. Do not diagnose or reference medical conditions.",
  "Respond with STRICT JSON ONLY:",
  '{"calorieTarget":number,"proteinTargetG":number,"carbsTargetG":number,"fatTargetG":number,"rationale":string}',
  "rationale = one short sentence on why today's number is set this way (plain English, encouraging)."
].join(" ");

function intFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function suggestDailyNutritionTarget(
  input: NutritionTargetInput
): Promise<DailyNutritionTarget> {
  if (testRun) {
    return testRun(input);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AINotConfiguredError();
  }

  const maxTokens = intFromEnv("OPENAI_MAX_TOKENS", 400);
  const timeoutMs = intFromEnv("OPENAI_TIMEOUT_MS", 30_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const b = input.baseline;
  const userText = [
    `Goal: ${input.goal === "lose" ? "lose weight" : "maintain weight"}.`,
    `Deterministic baseline (TDEE-derived): ${b.recommendedCalories} kcal, ` +
      `protein ${b.proteinTargetG}g, carbs ${b.carbsTargetG}g, fat ${b.fatTargetG}g. ` +
      `Calorie floor: ${b.minCalories}.`,
    input.profileContext?.trim() ? `Profile:\n${input.profileContext.trim()}` : "",
    input.metricsSummary?.trim() ? `Today's signals:\n${input.metricsSummary.trim()}` : "No extra signals provided.",
    "Return the strict JSON target for today now."
  ]
    .filter(Boolean)
    .join("\n\n");

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
            { role: "user", content: userText }
          ]
        })
      )
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Nutrition target request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw await buildOpenAIError(response, "Nutrition target");
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
    throw new Error("Nutrition target response was empty.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Nutrition target response was unreadable.");
  }

  return parseDailyNutritionTarget(parsed, input.baseline, input.date, new Date().toISOString(), "ai");
}
