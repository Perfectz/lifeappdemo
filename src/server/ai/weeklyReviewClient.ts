import { COACH_MODEL } from "@/config/ai";
import {
  clampWeeklyReviewFromAI,
  type WeeklyReview,
  type WeeklyReviewNarrative
} from "@/domain/weeklyReview";
import type { IsoDate } from "@/domain/types";
import { AINotConfiguredError, buildOpenAIError, chatCompletionBody } from "@/server/ai/openaiClient";

export type WeeklyReviewAIInput = {
  weekStart: IsoDate;
  /** The deterministic aggregation — every number the AI may reference. */
  review: WeeklyReview;
  /** Deterministic narrative — the ground truth the AI may rephrase, never recount. */
  deterministic: WeeklyReviewNarrative;
  /** About-me / profile narrative (optional). */
  profileContext?: string;
};

export type WeeklyReviewRun = (input: WeeklyReviewAIInput) => Promise<WeeklyReviewNarrative>;

let testRun: WeeklyReviewRun | undefined;

export function setWeeklyReviewForTests(run: WeeklyReviewRun | undefined) {
  testRun = run;
}

const SYSTEM_PROMPT = [
  "You are a supportive, no-nonsense fitness coach writing ONE person's week-in-review.",
  "You receive the deterministic weekly stats plus a deterministic narrative, wins, and focus list whose numbers are GROUND TRUTH.",
  "Rewrite the narrative as a 3-5 sentence coach-toned story of the week using the profile for voice and context, but NEVER change, contradict, or invent numbers (sessions, PRs, kcal, lb, %).",
  "wins and focus must be rephrasings of the deterministic items, same order, same count — do not add, drop, or reorder items.",
  "This is general fitness guidance, not medical advice. Do not diagnose or reference medical conditions.",
  "Respond with STRICT JSON ONLY:",
  '{"narrative":string,"wins":[string],"focus":[string]}',
  "narrative = 3-5 sentences; each win/focus item = one short sentence."
].join(" ");

function intFromEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function describeReview(review: WeeklyReview): string {
  const { training, nutrition, body, quests } = review;
  const lines = [
    `Week: ${review.range.start} to ${review.range.end}.`,
    `Training: ${training.totalSessions} sessions of a ${training.targetSessions}-session target ` +
      `(${training.sessionsByType.strength} strength, ${training.sessionsByType.cardio} cardio, ${training.sessionsByType.martial_arts} martial arts).`,
    training.bestLifts.length > 0
      ? `Best lifts: ${training.bestLifts
          .map((lift) => `${lift.exercise} e1RM ${lift.e1Rm} lb (${lift.weightLbs}×${lift.reps})`)
          .join("; ")}.`
      : "",
    training.newPRs.length > 0 ? `New PRs: ${training.newPRs.join("; ")}.` : "No new PRs this week.",
    training.kettlebellSwings > 0 ? `Kettlebell swings: ${training.kettlebellSwings}.` : "",
    training.karateClasses > 0 ? `Karate classes: ${training.karateClasses}.` : "",
    nutrition.daysLogged > 0
      ? `Nutrition: logged ${nutrition.daysLogged}/7 days, avg ${nutrition.avgCalories} kcal, ` +
        `${nutrition.avgProtein}g protein${nutrition.adherencePct !== null ? `, adherence ${nutrition.adherencePct}%` : ""}.`
      : "Nutrition: nothing logged.",
    nutrition.waterNote ?? "",
    body.weightDeltaLbs !== null
      ? `Weight: ${body.weightStartLbs} → ${body.weightEndLbs} lb (${body.weightDeltaLbs > 0 ? "+" : ""}${body.weightDeltaLbs} lb).`
      : "",
    body.avgSleepHours !== null ? `Avg sleep: ${body.avgSleepHours}h.` : "",
    body.avgEnergy !== null ? `Avg energy: ${body.avgEnergy}/5.` : "",
    `Quests: ${quests.completed} completed of ${quests.planned} planned.`
  ];
  return lines.filter(Boolean).join("\n");
}

function describeDeterministic(narrative: WeeklyReviewNarrative): string {
  return [
    `Narrative: ${narrative.narrative}`,
    ...narrative.wins.map((win, i) => `Win ${i + 1}: ${win}`),
    ...narrative.focus.map((item, i) => `Focus ${i + 1}: ${item}`)
  ].join("\n");
}

export async function suggestWeeklyReview(
  input: WeeklyReviewAIInput
): Promise<WeeklyReviewNarrative> {
  if (testRun) {
    return testRun(input);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AINotConfiguredError();
  }

  const maxTokens = intFromEnv("OPENAI_MAX_TOKENS", 600);
  const timeoutMs = intFromEnv("OPENAI_TIMEOUT_MS", 30_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const userText = [
    `Week starting: ${input.weekStart}.`,
    `Weekly stats (ground truth — keep every number):\n${describeReview(input.review)}`,
    `Deterministic review (rephrase, never recount):\n${describeDeterministic(input.deterministic)}`,
    input.profileContext?.trim() ? `Profile:\n${input.profileContext.trim()}` : "",
    "Rewrite the week in review as strict JSON now."
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
      throw new Error("Weekly review request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw await buildOpenAIError(response, "Weekly review");
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
    throw new Error("Weekly review response was empty.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Weekly review response was unreadable.");
  }

  return clampWeeklyReviewFromAI(parsed, input.deterministic, new Date().toISOString());
}
