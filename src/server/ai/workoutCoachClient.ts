import { COACH_MODEL } from "@/config/ai";
import { vinnyFewShotExamples, vinnyStyleGuide } from "@/domain/coachProgram";
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
  /** Training profile: equipment on hand, gym access, coach style. */
  profileSummary?: string;
  /** Per-lift e1RM + last-session numbers from the progression engine. */
  progressionSummary?: string;
  /** True when today's check-in already recorded a karate class. */
  karateToday?: boolean;
  /** The profile's coach style id (e.g. "vinny_split") — selects style guidance. */
  coachStyle?: string;
};

export type WorkoutSuggestionRun = (input: WorkoutSuggestionInput) => Promise<DailyWorkoutPlan>;

let testRun: WorkoutSuggestionRun | undefined;

export function setWorkoutCoachForTests(run: WorkoutSuggestionRun | undefined) {
  testRun = run;
}

const SYSTEM_PROMPT = [
  "You are a strength + conditioning coach PRESCRIBING today's training for one person — not just picking a workout.",
  "Propose up to THREE sessions, one per bucket: strength, cardio, martial_arts. The user only needs to complete ONE for a good day; the others are bonus — so make the strength session the primary, and keep cardio/martial-arts lighter optional add-ons.",
  "STRENGTH: prescribe exact sets×reps×load in the user's coach style from the TRAINING PROFILE. For 'simple progressive lifts': 1 main compound (rotate squat/bench/deadlift/overhead press/row per the progression snapshot), 1–2 secondary moves, and an optional kettlebell-swing finisher if they have a bell. For the Coach's split (Vinny): follow the VINNY STYLE GUIDE + EXAMPLE SESSIONS in the user message exactly, and set 'group' and 'scheme' on every prescription. Fill 'prescriptions' with one entry per lift: {exercise, sets, reps, weightLbs?, note, group?, scheme?}. Use the PROGRESSION SNAPSHOT numbers: if the target reps were hit last session, add load (+2.5–5 lb upper-body/dumbbell, +5–10 lb lower-body barbell); if they missed two sessions running, deload ~10%; fixed-load kettlebells progress reps (5→8) before sizing up. Each 'note' is one coach-toned line (e.g. \"Hit 5x5 @ 185 last week — take 190 today\"). Also set 'progressionSummary' to one line on where the progression stands.",
  "MARTIAL ARTS: if KARATE CLASS TODAY is yes, the martial_arts item must be titled 'Karate class ✓ counts as today's session' with a description suggesting an optional 10-min mobility cooldown. Otherwise program a short SOLO conditioning session — kata practice, bagwork combinations, footwork/agility drills, or 3×3-min conditioning rounds — with a concrete description, rotating so it isn't the same drill as the last couple of days.",
  "You may reference the provided PRESETS by exact id (kind:'preset', set presetId; for strength also set variant), but a custom prescribed strength session (kind:'custom' with 'prescriptions') is preferred when you have history numbers.",
  "Honor the user's context: never program around an injury (swap the movement and note it in 'swaps'); only use equipment from the training profile; fit the time they have; if readiness is poor (low sleep/energy), make it lighter.",
  "Keep each rationale to one short, motivating sentence. This is general fitness guidance, not medical advice.",
  "Respond with STRICT JSON ONLY:",
  '{"items":[{"bucket":"strength|cardio|martial_arts","kind":"preset|custom","presetId":string?,"variant":"Free Weight|Machine|Kettlebell"?,"title":string,"estMinutes":number,"exercises":string[]?,"description":string?,"swaps":string[]?,"prescriptions":[{"exercise":string,"sets":number,"reps":number,"weightLbs":number?,"note":string?,"group":string?,"scheme":string?}]?,"progressionSummary":string?,"rationale":string}],"note":string}'
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
  const vinny = input.coachStyle === "vinny_split";
  // Prescriptions (per-lift sets×reps×load + notes) make the JSON meaningfully
  // longer than the old pick-a-preset response, so the fallback budget is
  // higher — and a full Vinny day carries ~10 prescriptions, higher still.
  const maxTokens = intFromEnv("OPENAI_MAX_TOKENS", vinny ? 1_800 : 1_200);
  const timeoutMs = intFromEnv("OPENAI_TIMEOUT_MS", 30_000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const userText = [
    `Date: ${input.date}.`,
    `Goal: ${input.goal?.trim() || "general fitness, lean out while preserving muscle"}.`,
    input.profileSummary?.trim() ? `TRAINING PROFILE (equipment + coach style — program within this):\n${input.profileSummary.trim()}` : "",
    vinny ? vinnyStyleGuide : "",
    vinny ? vinnyFewShotExamples : "",
    input.progressionSummary?.trim()
      ? `PROGRESSION SNAPSHOT (per-lift e1RM + last session — prescribe exact loads from this${vinny ? "; these numbers are ground truth computed from the training log — do NOT contradict them" : ""}):\n${input.progressionSummary.trim()}`
      : "",
    `KARATE CLASS TODAY: ${input.karateToday ? "yes — class counts as the martial-arts session" : "no — program solo conditioning"}.`,
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
