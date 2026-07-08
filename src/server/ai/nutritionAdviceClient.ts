import { COACH_MODEL } from "@/config/ai";
import {
  clampAdviceFromAI,
  formatGapLabel,
  type NutritionAdvice
} from "@/domain/nutritionAdvice";
import type { IsoDate } from "@/domain/types";
import { AINotConfiguredError, buildOpenAIError, chatCompletionBody } from "@/server/ai/openaiClient";

export type NutritionAdviceInput = {
  date: IsoDate;
  /** Deterministic advice — the ground truth the AI may rephrase, never recount. */
  deterministic: NutritionAdvice;
  /** Today's diary at a glance (meals + totals). */
  diarySummary?: string;
  /** About-me / profile narrative (optional). */
  profileContext?: string;
  /** Saved nutrition coaching memories (optional). */
  memoryContext?: string;
};

export type NutritionAdviceRun = (input: NutritionAdviceInput) => Promise<NutritionAdvice>;

let testRun: NutritionAdviceRun | undefined;

export function setNutritionAdviceForTests(run: NutritionAdviceRun | undefined) {
  testRun = run;
}

const SYSTEM_PROMPT = [
  "You are a supportive, no-nonsense nutrition coach rewriting TODAY's advice for one person.",
  "You receive a deterministic advice block (verdict, nutrient gaps, warnings, timing) whose numbers are GROUND TRUTH.",
  "Rewrite it in a personal coach voice using the profile and memories: swap food suggestions for ones that fit their tastes and constraints, but NEVER change, contradict, or omit the numbers (kcal remaining, grams short).",
  "Keep at most 3 gap suggestions. Do not invent new warnings — only rephrase the ones given.",
  "This is general fitness guidance, not medical or dietetic advice. Do not diagnose or reference medical conditions.",
  "Respond with STRICT JSON ONLY:",
  '{"verdict":string,"gaps":[{"nutrient":"protein"|"calories"|"fiber","suggestion":string}],"warnings":[string],"timing":string}',
  "verdict = one short sentence; each suggestion = one concrete food idea; timing = one sentence of meal-aware guidance."
].join(" ");

function intFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function describeDeterministic(advice: NutritionAdvice): string {
  const lines = [
    `Verdict: ${advice.verdict}`,
    ...advice.gaps.map(
      (gap) => `Gap (${gap.nutrient}): ${formatGapLabel(gap)} — ${gap.suggestion}`
    ),
    ...advice.warnings.map((warning) => `Warning: ${warning}`),
    `Timing: ${advice.timing}`
  ];
  return lines.join("\n");
}

export async function suggestDailyNutritionAdvice(
  input: NutritionAdviceInput
): Promise<NutritionAdvice> {
  if (testRun) {
    return testRun(input);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AINotConfiguredError();
  }

  const maxTokens = intFromEnv("OPENAI_MAX_TOKENS", 500);
  const timeoutMs = intFromEnv("OPENAI_TIMEOUT_MS", 30_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const userText = [
    `Date: ${input.date}.`,
    `Deterministic advice (ground truth — keep every number):\n${describeDeterministic(input.deterministic)}`,
    input.diarySummary?.trim() ? `Today's diary:\n${input.diarySummary.trim()}` : "",
    input.profileContext?.trim() ? `Profile:\n${input.profileContext.trim()}` : "",
    input.memoryContext?.trim() ? `Coaching memories:\n${input.memoryContext.trim()}` : "",
    "Rewrite the advice as strict JSON now."
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
          temperature: 0.5,
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
      throw new Error("Nutrition advice request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw await buildOpenAIError(response, "Nutrition advice");
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
    throw new Error("Nutrition advice response was empty.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Nutrition advice response was unreadable.");
  }

  return clampAdviceFromAI(parsed, input.deterministic, new Date().toISOString());
}
