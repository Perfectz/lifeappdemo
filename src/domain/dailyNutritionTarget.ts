/**
 * A per-day calorie + macro target, recomputed daily from the user's metrics
 * (weight, body stats, activity, goal, recent trend, training load) rather than
 * set once and forgotten.
 *
 * Safety: an AI may personalize the target, but only WITHIN A BAND around the
 * deterministic TDEE baseline, and never below a sex-based calorie floor. The
 * parser clamps every field, so a bad model response can't produce an unsafe or
 * absurd target.
 */

import type { CalorieBudget } from "@/domain/calorieBudget";
import type { IsoDate, IsoDateTime } from "@/domain/types";

export const nutritionTargetSources = ["ai", "adaptive", "computed", "manual"] as const;
export type NutritionTargetSource = (typeof nutritionTargetSources)[number];

export const nutritionTargetSourceLabel: Record<NutritionTargetSource, string> = {
  ai: "AI-tuned",
  adaptive: "Adaptive",
  computed: "Auto",
  manual: "Manual"
};

/** How far the AI may move calories from the deterministic baseline (±). */
export const TARGET_CALORIE_BAND = 0.18;

export type DailyNutritionTarget = {
  date: IsoDate;
  calorieTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  /** Short plain-English "why today's number is what it is". */
  rationale: string;
  source: NutritionTargetSource;
  createdAt: IsoDateTime;
};

/** Deterministic baseline + the floor used to bound any AI adjustment. */
export type TargetBaseline = {
  recommendedCalories: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  minCalories: number;
};

export function baselineFromBudget(budget: CalorieBudget, minCalories: number): TargetBaseline {
  return {
    recommendedCalories: budget.recommendedCalories,
    proteinTargetG: budget.proteinTargetG,
    carbsTargetG: budget.carbsTargetG,
    fatTargetG: budget.fatTargetG,
    minCalories
  };
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  const safe = Number.isFinite(n) ? n : fallback;
  return Math.max(min, Math.min(max, Math.round(safe)));
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Clamp an AI/raw target to a safe band around the baseline. Always returns a
 * valid, coherent DailyNutritionTarget.
 */
export function parseDailyNutritionTarget(
  value: unknown,
  baseline: TargetBaseline,
  date: IsoDate,
  now: IsoDateTime,
  source: NutritionTargetSource = "ai"
): DailyNutritionTarget {
  const r = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;

  const calMin = Math.max(
    baseline.minCalories,
    Math.round(baseline.recommendedCalories * (1 - TARGET_CALORIE_BAND))
  );
  const calMax = Math.round(baseline.recommendedCalories * (1 + TARGET_CALORIE_BAND));
  const calorieTarget = clampInt(r.calorieTarget, baseline.recommendedCalories, calMin, calMax);

  // Macros: allow a wider band (training days shift the split) but stay sane.
  const proteinTargetG = clampInt(
    r.proteinTargetG,
    baseline.proteinTargetG,
    Math.max(1, Math.round(baseline.proteinTargetG * 0.6)),
    Math.round(baseline.proteinTargetG * 1.8)
  );
  const fatTargetG = clampInt(
    r.fatTargetG,
    baseline.fatTargetG,
    Math.max(1, Math.round(baseline.fatTargetG * 0.5)),
    Math.round(baseline.fatTargetG * 1.8)
  );
  // Carbs default to whatever fills the remaining calories, so the macros stay
  // coherent with the calorie target even if the model omits them.
  const carbsFromRemainder = Math.max(
    0,
    Math.round((calorieTarget - proteinTargetG * 4 - fatTargetG * 9) / 4)
  );
  const carbsTargetG = clampInt(r.carbsTargetG, carbsFromRemainder, 0, carbsFromRemainder + 80);

  return {
    date,
    calorieTarget,
    proteinTargetG,
    carbsTargetG,
    fatTargetG,
    rationale: asString(r.rationale),
    source,
    createdAt: now
  };
}

/** Deterministic target straight from the baseline (no AI day-nudge). */
export function computedTarget(
  baseline: TargetBaseline,
  date: IsoDate,
  now: IsoDateTime,
  rationale: string,
  source: NutritionTargetSource = "computed"
): DailyNutritionTarget {
  return {
    date,
    calorieTarget: Math.max(baseline.minCalories, Math.round(baseline.recommendedCalories)),
    proteinTargetG: Math.round(baseline.proteinTargetG),
    carbsTargetG: Math.round(baseline.carbsTargetG),
    fatTargetG: Math.round(baseline.fatTargetG),
    rationale,
    source,
    createdAt: now
  };
}

function isPositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function isDailyNutritionTarget(value: unknown): value is DailyNutritionTarget {
  if (!value || typeof value !== "object") return false;
  const t = value as Partial<DailyNutritionTarget>;
  return (
    typeof t.date === "string" &&
    isPositive(t.calorieTarget) &&
    typeof t.proteinTargetG === "number" &&
    typeof t.carbsTargetG === "number" &&
    typeof t.fatTargetG === "number" &&
    typeof t.createdAt === "string" &&
    nutritionTargetSources.includes(t.source as NutritionTargetSource)
  );
}
