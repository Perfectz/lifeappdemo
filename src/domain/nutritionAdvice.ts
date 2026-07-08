/**
 * Daily nutrition ADVICE — the "so what do I eat now?" layer on top of the
 * daily calorie/macro target.
 *
 * `buildNutritionAdvice` is pure and deterministic: given the target, today's
 * logged entries, and the time of day, it produces a one-line verdict, concrete
 * per-nutrient gaps with food suggestions from a small built-in table, safety
 * warnings, and meal-aware timing guidance. An AI may rewrite the wording in a
 * personal coach tone, but `clampAdviceFromAI` guarantees the numbers (kcal
 * remaining, grams short) always come from this deterministic engine — the AI
 * can rephrase, never recount.
 */

import type { DailyNutritionTarget } from "@/domain/dailyNutritionTarget";
import { sumMacros } from "@/domain/nutrition";
import type { FoodEntry, IsoDate, IsoDateTime } from "@/domain/types";

export const adviceNutrients = ["protein", "calories", "fiber"] as const;
export type AdviceNutrient = (typeof adviceNutrients)[number];

export type NutritionGap = {
  nutrient: AdviceNutrient;
  /** Amount still needed — grams for macros, kcal for calories. */
  short: number;
  /** Concrete food suggestion for closing this gap. */
  suggestion: string;
};

export const nutritionAdviceSources = ["deterministic", "ai"] as const;
export type NutritionAdviceSource = (typeof nutritionAdviceSources)[number];

export type NutritionAdvice = {
  date: IsoDate;
  /** One-line day status, e.g. "On track — 620 kcal and 48g protein left, dinner-sized." */
  verdict: string;
  gaps: NutritionGap[];
  warnings: string[];
  /** Meal-aware guidance: day plan in the morning, dinner shape in the evening. */
  timing: string;
  source: NutritionAdviceSource;
  createdAt: IsoDateTime;
};

export type NutritionAdviceInput = {
  date: IsoDate;
  now: IsoDateTime;
  /** Today's computed target; null when the profile is incomplete. */
  target: DailyNutritionTarget | null;
  entriesToday: FoodEntry[];
  /** Minutes since local midnight (e.g. 19:30 → 1170). */
  nowMinutes: number;
  /** 7-day weight change in lb (negative = losing). */
  weightDelta7d?: number;
  trainedToday?: boolean;
};

export type DayPhase = "morning" | "midday" | "evening";

const MORNING_END_MINUTES = 11 * 60;
const EVENING_START_MINUTES = 17 * 60;

/** Tolerance around the calorie target before we call the day over/hit. */
export const OVER_BUDGET_TOLERANCE_KCAL = 75;
/** Smallest protein shortfall worth nagging about. */
export const PROTEIN_GAP_MIN_G = 10;
/** Smallest fiber shortfall worth flagging (once meals are logged). */
export const FIBER_GAP_MIN_G = 8;
/** Evening calorie remainder small enough to skip a "calories unspent" gap. */
export const EVENING_CALORIE_GAP_MIN_KCAL = 250;
/** Rough fiber goal derived from the calorie target (AI-free heuristic). */
export const FIBER_G_PER_1000_KCAL = 14;

export function dayPhase(nowMinutes: number): DayPhase {
  if (nowMinutes < MORNING_END_MINUTES) return "morning";
  if (nowMinutes < EVENING_START_MINUTES) return "midday";
  return "evening";
}

/** Small built-in food tables the rules pick from. */
const FOODS = {
  proteinLarge:
    "grilled chicken breast (~40g), a protein shake (~25g), and greek yogurt (~17g) across your remaining meals",
  proteinMedium: "grilled chicken breast, salmon, or a protein shake",
  proteinSmall: "greek yogurt, cottage cheese, or a couple of eggs",
  proteinLean: "go lean: chicken breast, white fish, or nonfat greek yogurt",
  fiber: "berries, beans or lentils, or a big vegetable side",
  lightDinner: "lean protein + vegetables (grilled chicken or white fish with a big salad)",
  balancedDinner: "lean protein + vegetables + a smart carb"
} as const;

function mealWord(phase: DayPhase): string {
  if (phase === "morning") return "across today's meals";
  if (phase === "midday") return "at lunch or dinner";
  return "at dinner";
}

function proteinSuggestion(short: number, phase: DayPhase, lean: boolean): string {
  if (lean) return `${FOODS.proteinLean} ${mealWord(phase)}`;
  if (short >= 50) return FOODS.proteinLarge;
  if (short >= 25) return `${FOODS.proteinMedium} ${mealWord(phase)}`;
  return `${FOODS.proteinSmall} ${mealWord(phase)}`;
}

/** "~48g protein short" / "~620 kcal unspent" — display label for a gap. */
export function formatGapLabel(gap: NutritionGap): string {
  if (gap.nutrient === "calories") return `~${gap.short} kcal unspent`;
  return `~${gap.short}g ${gap.nutrient} short`;
}

export function fiberTargetFromCalories(calorieTarget: number): number {
  return Math.round((calorieTarget / 1000) * FIBER_G_PER_1000_KCAL);
}

export function buildNutritionAdvice(input: NutritionAdviceInput): NutritionAdvice {
  const { date, now, target, entriesToday, nowMinutes, weightDelta7d, trainedToday } = input;
  const phase = dayPhase(nowMinutes);

  if (!target) {
    return {
      date,
      verdict:
        "No daily target yet — finish your profile (sex, age, height, activity) and log a weight to unlock coaching.",
      gaps: [],
      warnings: [],
      timing: "Once your target is set, you'll get meal-by-meal advice here.",
      source: "deterministic",
      createdAt: now
    };
  }

  const totals = sumMacros(entriesToday);
  const consumed = Math.round(totals.calories);
  const calTarget = Math.round(target.calorieTarget);
  const remaining = calTarget - consumed;
  const proteinShort = Math.round(target.proteinTargetG - totals.proteinG);
  const fiberTarget = fiberTargetFromCalories(calTarget);
  const fiberShort = Math.round(fiberTarget - totals.fiberG);

  const over = remaining < -OVER_BUDGET_TOLERANCE_KCAL;
  const targetHit = !over && remaining <= OVER_BUDGET_TOLERANCE_KCAL && proteinShort < PROTEIN_GAP_MIN_G;
  const nothingLogged = entriesToday.length === 0;

  const gaps: NutritionGap[] = [];
  const warnings: string[] = [];

  // --- Gaps (only meaningful once something is logged / budget known) ---
  if (!nothingLogged && proteinShort >= PROTEIN_GAP_MIN_G) {
    gaps.push({
      nutrient: "protein",
      short: proteinShort,
      suggestion: proteinSuggestion(proteinShort, phase, over)
    });
  }
  if (!nothingLogged && !over && phase === "evening" && remaining >= EVENING_CALORIE_GAP_MIN_KCAL) {
    gaps.push({
      nutrient: "calories",
      short: remaining,
      suggestion: `don't skip dinner — a ~${remaining} kcal plate of ${FOODS.balancedDinner} keeps tomorrow's hunger in check`
    });
  }
  if (!nothingLogged && phase !== "morning" && fiberShort >= FIBER_GAP_MIN_G) {
    gaps.push({
      nutrient: "fiber",
      short: fiberShort,
      suggestion: `add ${FOODS.fiber} ${mealWord(phase)}`
    });
  }

  // --- Warnings ---
  if (over) {
    warnings.push(
      `Already ${Math.abs(remaining)} kcal over target — make ${
        phase === "evening" ? "dinner" : "the rest of today"
      } light: ${FOODS.lightDinner}.`
    );
  } else if (proteinShort >= PROTEIN_GAP_MIN_G && remaining < proteinShort * 4) {
    warnings.push(
      `Little calorie room left for ${proteinShort}g of protein — ${FOODS.proteinLean}.`
    );
  }
  if (nothingLogged && phase === "evening") {
    warnings.push("The whole day is unlogged — jot down what you've eaten so the numbers stay honest.");
  }
  if (typeof weightDelta7d === "number" && weightDelta7d <= -3) {
    warnings.push(
      `Weight is down ${Math.abs(Math.round(weightDelta7d * 10) / 10)} lb this week — faster than ideal. Don't under-eat; land near your target, not far below it.`
    );
  } else if (typeof weightDelta7d === "number" && weightDelta7d >= 2) {
    warnings.push(
      `Weight is up ${Math.round(weightDelta7d * 10) / 10} lb this week — tighten portions and stick to the plan tonight.`
    );
  }

  // --- Verdict + timing ---
  let verdict: string;
  let timing: string;

  if (nothingLogged) {
    verdict = `Nothing logged yet — ${calTarget} kcal and ${Math.round(target.proteinTargetG)}g protein to work with today.`;
    timing =
      phase === "evening"
        ? `Log the day, then keep dinner around ${FOODS.balancedDinner}.`
        : `Plan the day: roughly ${Math.round(calTarget / 3)} kcal per meal with ~${Math.round(
            target.proteinTargetG / 3
          )}g protein at each${trainedToday ? " — you trained, so don't skimp" : ""}.`;
  } else if (over) {
    verdict = `Over budget — ${Math.abs(remaining)} kcal past today's ${calTarget} kcal target.`;
    timing =
      "One over day doesn't break the week — skip the extras tonight and reset at breakfast.";
  } else if (targetHit) {
    verdict = `Day handled — ${consumed} of ${calTarget} kcal and protein where it should be.`;
    timing = "Target hit — hold the line: water, tea, or a walk instead of extra snacks tonight.";
  } else {
    const proteinLeft = Math.max(0, proteinShort);
    verdict = `On track — ${remaining} kcal and ${proteinLeft}g protein left${
      phase === "evening" ? ", dinner-sized" : ""
    }.`;
    if (phase === "morning") {
      timing = `Morning: front-load protein and spread the remaining ~${remaining} kcal across your meals${
        trainedToday ? " — training day, so keep carbs around your session" : ""
      }.`;
    } else if (phase === "midday") {
      timing = `Afternoon: keep snacks protein-first so dinner can be ~${Math.round(
        remaining * 0.6
      )} kcal without going over.`;
    } else {
      timing = `Dinner should be ~${remaining} kcal: ${FOODS.balancedDinner}${
        trainedToday ? " — you trained today, so include a real carb portion (rice, potatoes)" : ""
      }.`;
    }
  }

  return {
    date,
    verdict,
    gaps: gaps.slice(0, 3),
    warnings: warnings.slice(0, 3),
    timing,
    source: "deterministic",
    createdAt: now
  };
}

function isNutritionGap(value: unknown): value is NutritionGap {
  if (!value || typeof value !== "object") return false;
  const gap = value as Partial<NutritionGap>;
  return (
    adviceNutrients.includes(gap.nutrient as AdviceNutrient) &&
    typeof gap.short === "number" &&
    Number.isFinite(gap.short) &&
    typeof gap.suggestion === "string"
  );
}

export function isNutritionAdvice(value: unknown): value is NutritionAdvice {
  if (!value || typeof value !== "object") return false;
  const advice = value as Partial<NutritionAdvice>;
  return (
    typeof advice.date === "string" &&
    typeof advice.verdict === "string" &&
    advice.verdict.trim().length > 0 &&
    Array.isArray(advice.gaps) &&
    advice.gaps.every(isNutritionGap) &&
    Array.isArray(advice.warnings) &&
    advice.warnings.every((warning) => typeof warning === "string") &&
    typeof advice.timing === "string" &&
    nutritionAdviceSources.includes(advice.source as NutritionAdviceSource) &&
    typeof advice.createdAt === "string"
  );
}

const MAX_ADVICE_TEXT = 260;

function cleanText(value: unknown, fallback: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, MAX_ADVICE_TEXT) : fallback;
}

/**
 * Clamp an AI rewrite to the deterministic ground truth. The AI may only
 * rephrase: gap nutrients + `short` amounts come from the deterministic
 * advice, warnings can't be invented (only rephrased, count-capped by the
 * deterministic set), and any missing/empty field falls back verbatim.
 */
export function clampAdviceFromAI(
  value: unknown,
  deterministic: NutritionAdvice,
  now: IsoDateTime = new Date().toISOString()
): NutritionAdvice {
  const r = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;

  const rawGaps = Array.isArray(r.gaps) ? (r.gaps as unknown[]) : [];
  const gaps: NutritionGap[] = deterministic.gaps.slice(0, 3).map((gap) => {
    const match = rawGaps.find(
      (candidate) =>
        candidate &&
        typeof candidate === "object" &&
        (candidate as { nutrient?: unknown }).nutrient === gap.nutrient
    ) as { suggestion?: unknown } | undefined;
    return { ...gap, suggestion: cleanText(match?.suggestion, gap.suggestion) };
  });

  const rawWarnings = Array.isArray(r.warnings)
    ? (r.warnings as unknown[]).filter((w): w is string => typeof w === "string" && w.trim().length > 0)
    : [];
  // The AI can't add warnings the engine didn't raise — only rephrase them.
  const warnings = deterministic.warnings.map((warning, index) =>
    cleanText(rawWarnings[index], warning)
  );

  return {
    date: deterministic.date,
    verdict: cleanText(r.verdict, deterministic.verdict),
    gaps,
    warnings,
    timing: cleanText(r.timing, deterministic.timing),
    source: "ai",
    createdAt: now
  };
}
