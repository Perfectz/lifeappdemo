/**
 * Resolves TODAY's calorie + macro target from the user's metrics.
 *
 * Pipeline: deterministic TDEE baseline (computeCalorieBudget) → optional AI
 * personalization for today's signals (weight trend, training, sleep, recent
 * intake) within safe guardrails → cached once per day. Falls back to the
 * deterministic number whenever the AI is unavailable, so the target is always
 * "determined daily from your metrics" even with no API key.
 */

import { getAuthHeaders } from "@/client/authToken";
import { loadBodyProfile } from "@/data/bodyProfileRepository";
import { loadHealthGoals } from "@/data/healthGoalsRepository";
import { createLocalFoodEntryRepository } from "@/data/foodEntryRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalWorkoutRepository } from "@/data/workoutRepository";
import {
  clearTargetForDate,
  getTargetForDate,
  upsertDailyTarget
} from "@/data/dailyNutritionTargetRepository";
import { loadWiki } from "@/data/wikiRepository";
import { upsertExpenditureEstimate } from "@/data/expenditureEstimateRepository";
import { computeCalorieBudget, MIN_CALORIES, macroSplit } from "@/domain/calorieBudget";
import {
  computeAdaptiveTdee,
  targetFromTdee,
  type AdaptiveTdeeResult,
  type WeightSample
} from "@/domain/adaptiveTdee";
import {
  baselineFromBudget,
  computedTarget,
  isDailyNutritionTarget,
  type DailyNutritionTarget,
  type TargetBaseline
} from "@/domain/dailyNutritionTarget";
import { toLocalIsoDate } from "@/domain/dates";
import { getLatestMetricEntry } from "@/domain/metrics";
import { getFoodEntriesForDate, sumMacros } from "@/domain/nutrition";
import { formatWikiForPrompt, isWikiEmpty } from "@/domain/personalWiki";
import type { IsoDate, MetricEntry } from "@/domain";

function isoShift(date: IsoDate, deltaDays: number): IsoDate {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return toLocalIsoDate(d);
}

function daysBetween(earlier: IsoDate, later: IsoDate): number {
  const a = Date.parse(`${earlier}T00:00:00`);
  const b = Date.parse(`${later}T00:00:00`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

export type TargetComputation = {
  baseline: TargetBaseline;
  goal: "lose" | "maintain";
  deterministic: DailyNutritionTarget;
  adaptive: AdaptiveTdeeResult;
  profileContext?: string;
  metricsSummary: string;
};

/** How many trailing days of data feed the adaptive expenditure estimate. */
const ADAPTIVE_WINDOW_DAYS = 21;

function gatherIntakeWindow(
  storage: Storage,
  date: IsoDate,
  windowDays: number
): { avgDailyIntake: number; loggedDays: number } {
  const foods = createLocalFoodEntryRepository(storage).load();
  const daily: number[] = [];
  for (let i = 0; i < windowDays; i += 1) {
    const cals = sumMacros(getFoodEntriesForDate(foods, isoShift(date, -i))).calories;
    if (cals > 0) daily.push(cals);
  }
  const avgDailyIntake =
    daily.length > 0 ? daily.reduce((a, b) => a + b, 0) / daily.length : 0;
  return { avgDailyIntake, loggedDays: daily.length };
}

function formatGoalRate(rate: number): string {
  if (rate < 0) return `${rate} lb/wk`;
  if (rate > 0) return `+${rate} lb/wk`;
  return "maintain";
}

function buildMetricsSummary(
  storage: Storage,
  date: IsoDate,
  metrics: MetricEntry[],
  weightLbs: number,
  goalWeight?: number
): string {
  const parts: string[] = [];
  parts.push(`Current weight ${weightLbs} lb${goalWeight ? `, goal ${goalWeight} lb` : ""}.`);

  const weights = metrics
    .filter((m) => typeof m.weightLbs === "number")
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const weekAgo = weights.find((m) => daysBetween(m.date, date) >= 7);
  if (weekAgo?.weightLbs) {
    const delta = Math.round((weightLbs - weekAgo.weightLbs) * 10) / 10;
    parts.push(`7-day weight change ${delta >= 0 ? "+" : ""}${delta} lb.`);
  }

  const workoutsToday = createLocalWorkoutRepository(storage)
    .load()
    .filter((w) => w.date === date);
  if (workoutsToday.length > 0) {
    const mins = workoutsToday.reduce((s, w) => s + (w.durationMinutes ?? 0), 0);
    const types = Array.from(new Set(workoutsToday.map((w) => w.type))).join(", ");
    parts.push(`Today: ${workoutsToday.length} workout(s) (${types})${mins ? `, ~${mins} min` : ""}.`);
  } else {
    parts.push("No workout logged yet today.");
  }

  const latest = getLatestMetricEntry(metrics);
  if (latest?.sleepHours) parts.push(`Recent sleep ${latest.sleepHours}h.`);

  const foods = createLocalFoodEntryRepository(storage).load();
  const recentCals: number[] = [];
  for (let i = 1; i <= 7; i += 1) {
    const cals = sumMacros(getFoodEntriesForDate(foods, isoShift(date, -i))).calories;
    if (cals > 0) recentCals.push(cals);
  }
  if (recentCals.length > 0) {
    const avg = Math.round(recentCals.reduce((a, b) => a + b, 0) / recentCals.length);
    parts.push(`Avg logged intake last ${recentCals.length} day(s): ${avg} kcal.`);
  }

  return parts.join(" ");
}

/** Build the deterministic baseline + context. Returns null if body stats are incomplete. */
export function buildTargetComputation(
  storage: Storage,
  date: IsoDate,
  now: string
): TargetComputation | null {
  const profile = loadBodyProfile(storage);
  const metrics = createLocalMetricRepository(storage).load();
  const weightLbs = getLatestMetricEntry(metrics)?.weightLbs;

  if (!profile.sex || !profile.age || !profile.heightInches || !profile.activityLevel || !weightLbs) {
    return null;
  }

  const health = loadHealthGoals(storage);
  const targetWeightLbs = health.weightTargetLbs;
  const goal: "lose" | "maintain" =
    targetWeightLbs && targetWeightLbs < weightLbs ? "lose" : "maintain";

  const budget = computeCalorieBudget({
    sex: profile.sex,
    age: profile.age,
    heightInches: profile.heightInches,
    weightLbs,
    activityLevel: profile.activityLevel,
    targetWeightLbs,
    goal
  });
  const minCalories = MIN_CALORIES[profile.sex];

  // Adaptive: learn expenditure from the trailing window of weight + intake.
  const weightSamples: WeightSample[] = metrics
    .filter(
      (m) =>
        typeof m.weightLbs === "number" && daysBetween(m.date, date) >= 0 &&
        daysBetween(m.date, date) < ADAPTIVE_WINDOW_DAYS
    )
    .map((m) => ({ date: m.date, weightLbs: m.weightLbs as number }));
  const { avgDailyIntake, loggedDays } = gatherIntakeWindow(storage, date, ADAPTIVE_WINDOW_DAYS);
  const adaptive = computeAdaptiveTdee({
    mifflinTdee: budget.tdee,
    weightSamples,
    avgDailyIntake,
    loggedDays,
    windowDays: ADAPTIVE_WINDOW_DAYS
  });

  const goalRate =
    health.weeklyWeightChangeTargetLbs ?? (goal === "lose" ? -1 : 0);
  const anchorWeight = targetWeightLbs ?? weightLbs;

  let baseline: TargetBaseline;
  let deterministic: DailyNutritionTarget;

  if (adaptive.confidence > 0) {
    const calories = targetFromTdee(adaptive.tdeeEstimate, goalRate, minCalories);
    const macros = macroSplit(calories, anchorWeight);
    baseline = { recommendedCalories: calories, ...macros, minCalories };
    const rationale =
      `Adaptive · TDEE ≈ ${adaptive.tdeeEstimate} kcal · ` +
      `learning ${Math.round(adaptive.confidence * 100)}% · ${formatGoalRate(goalRate)}.`;
    deterministic = computedTarget(baseline, date, now, rationale, "adaptive");
  } else {
    baseline = baselineFromBudget(budget, minCalories);
    const rationale =
      `Auto target from your stats (${Math.round(weightLbs)} lb, ` +
      `${goal === "lose" ? "fat loss" : "maintenance"}). TDEE ≈ ${budget.tdee} kcal` +
      `${goal === "lose" ? " − 500 deficit" : ""}.`;
    deterministic = computedTarget(baseline, date, now, rationale);
  }

  const wiki = loadWiki(storage);
  const profileContext = isWikiEmpty(wiki) ? undefined : formatWikiForPrompt(wiki, 2000);

  return {
    baseline,
    goal,
    deterministic,
    adaptive,
    profileContext,
    metricsSummary: buildMetricsSummary(storage, date, metrics, weightLbs, targetWeightLbs)
  };
}

// Module-level guard so React StrictMode's double-invoked effect (and any
// concurrent callers) share one compute per day instead of racing duplicate
// paid AI calls. Same pattern as timelineSeed.
let inFlightTarget: { date: IsoDate; promise: Promise<DailyNutritionTarget | null> } | null = null;

/** Today's target — cached, else computed (AI-tuned when available, deterministic otherwise). */
export async function getOrComputeDailyTarget(
  storage: Storage = window.localStorage
): Promise<DailyNutritionTarget | null> {
  const date = toLocalIsoDate();
  const existing = getTargetForDate(storage, date);
  if (existing) return existing;

  if (inFlightTarget?.date === date) return inFlightTarget.promise;
  const promise = computeDailyTarget(storage, date).finally(() => {
    if (inFlightTarget?.promise === promise) inFlightTarget = null;
  });
  inFlightTarget = { date, promise };
  return promise;
}

async function computeDailyTarget(
  storage: Storage,
  date: IsoDate
): Promise<DailyNutritionTarget | null> {
  const now = new Date().toISOString();
  const comp = buildTargetComputation(storage, date, now);
  if (!comp) return null; // not enough body data — diary falls back to manual goals

  let target = comp.deterministic;
  try {
    const response = await fetch("/api/ai/nutrition-target", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify({
        date,
        baseline: comp.baseline,
        goal: comp.goal,
        profileContext: comp.profileContext,
        metricsSummary: comp.metricsSummary
      })
    });
    if (response.ok) {
      const data = await response.json();
      if (isDailyNutritionTarget(data)) target = data;
    }
  } catch {
    // Network/AI down — keep the deterministic target.
  }

  upsertDailyTarget(storage, target);

  // Snapshot today's expenditure estimate for the trend / transparency.
  upsertExpenditureEstimate(storage, {
    date,
    tdeeEstimate: comp.adaptive.tdeeEstimate,
    confidence: comp.adaptive.confidence,
    trendWeightLb: comp.adaptive.trendWeightLb,
    createdAt: now
  });

  return target;
}

/** Force a fresh target for today (clears the cache first). */
export async function recomputeDailyTarget(
  storage: Storage = window.localStorage
): Promise<DailyNutritionTarget | null> {
  clearTargetForDate(storage, toLocalIsoDate());
  return getOrComputeDailyTarget(storage);
}

/** Persist a manual override for today (wins until the user recalculates). */
export function setManualDailyTarget(
  storage: Storage,
  edits: Partial<Pick<DailyNutritionTarget, "calorieTarget" | "proteinTargetG" | "carbsTargetG" | "fatTargetG">>
): DailyNutritionTarget | null {
  const date = toLocalIsoDate();
  const now = new Date().toISOString();
  const base =
    getTargetForDate(storage, date) ?? buildTargetComputation(storage, date, now)?.deterministic;
  if (!base && edits.calorieTarget === undefined) return null;

  const merged: DailyNutritionTarget = {
    date,
    calorieTarget: edits.calorieTarget ?? base?.calorieTarget ?? 0,
    proteinTargetG: edits.proteinTargetG ?? base?.proteinTargetG ?? 0,
    carbsTargetG: edits.carbsTargetG ?? base?.carbsTargetG ?? 0,
    fatTargetG: edits.fatTargetG ?? base?.fatTargetG ?? 0,
    rationale: "Manually set for today.",
    source: "manual",
    createdAt: now
  };
  upsertDailyTarget(storage, merged);
  return merged;
}
