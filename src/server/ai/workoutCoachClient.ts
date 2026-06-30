import { COACH_MODEL } from "@/config/ai";
import {
  buildWorkoutCatalog,
  formatCatalogForPrompt,
  parseDailyWorkoutPlan,
  type DailyWorkoutPlan
} from "@/domain/workoutPlan";
import type { IsoDate } from "@/domain/types";
import { AINotConfiguredError, buildOpenAIError, chatCompletionBody } from "@/server/ai/openaiClient";

export type WorkoutSuggestionInput = {
  date: IsoDate;
  /** Recent training history (what was done lately, by bucket/day). */
  historySummary?: string;
  /** Coaching memory relevant to training: injuries, equipment, schedule. */
  memorySummary?: string;
  /** Readiness signals: recent sleep, energy, soreness. */
  readiness?: string;
  /** "lose" / "maintain" + any goal context. */
  goal?: string;
};

export type WorkoutSuggestionRun = (input: WorkoutSuggestionInput) => Promise<DailyWorkoutPlan>;

let testRun: WorkoutSuggestionRun | undefined;

export function setWorkoutCoachForTests(run: WorkoutSuggestionRun | undefined) {
  testRun = run;
}

const SYSTEM_PROMPT = [
  "You are a strength + conditioning coach choosing TODAY's training plan for one person.",
  "Propose up to THREE sessions, one per bucket: strength, cardio, martial_arts. The user only needs to complete ONE for a good day; the others are bonus — so make the strength session the primary, and keep cardio/martial-arts lighter optional add-ons.",
  "Prefer the provided PRESETS by their exact id (kind:'preset', set presetId; for strength also set variant). If a preset doesn't fit (injury, time, variety), generate a custom session instead (kind:'custom', give a title + an 'exercises' list for strength or a 'description' for cardio/martial-arts).",
  "Honor the user's context: never program around an injury (swap the movement and note it in 'swaps'); only use equipment they have; fit the time they have; if readiness is poor (low sleep/energy), make it lighter.",
  "Rotate strength focus so you don't repeat the same muscle groups they trained in the last day or two.",
  "Keep each rationale to one short, motivating sentence. This is general fitness guidance, not medical advice.",
  "Respond with STRICT JSON ONLY:",
  '{"items":[{"bucket":"strength|cardio|martial_arts","kind":"preset|custom","presetId":string?,"variant":"Free Weight|Machine|Kettlebell"?,"title":string,"estMinutes":number,"exercises":string[]?,"description":string?,"swaps":string[]?,"rationale":string}],"note":string}'
].join(" ");

function intFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function suggestDailyWorkoutPlan(
  input: WorkoutSuggestionInput
): Promise<DailyWorkoutPlan> {
  if (testRun) {
    return testRun(input);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AINotConfiguredError();
  }

  const catalog = buildWorkoutCatalog();
  const maxTokens = intFromEnv("OPENAI_MAX_TOKENS", 800);
  const timeoutMs = intFromEnv("OPENAI_TIMEOUT_MS", 30_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const userText = [
    `Date: ${input.date}.`,
    `Goal: ${input.goal?.trim() || "general fitness, lean out while preserving muscle"}.`,
    `AVAILABLE PRESETS:\n${formatCatalogForPrompt(catalog)}`,
    input.memorySummary?.trim() ? `WHAT I KNOW (honor injuries/equipment/schedule):\n${input.memorySummary.trim()}` : "",
    input.historySummary?.trim() ? `RECENT TRAINING:\n${input.historySummary.trim()}` : "No recent training logged.",
    input.readiness?.trim() ? `READINESS:\n${input.readiness.trim()}` : "",
    "Return the strict JSON plan now."
  ]
    .filter(Boolean)
    .join("\n\n");

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
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
      throw new Error("Workout suggestion timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw await buildOpenAIError(response, "Workout suggestion");
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
    throw new Error("Workout suggestion was empty.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Workout suggestion was unreadable.");
  }

  return parseDailyWorkoutPlan(parsed, catalog, input.date, new Date().toISOString(), "ai");
}
