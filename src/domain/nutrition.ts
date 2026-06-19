import type {
  EstimateConfidence,
  FoodEntry,
  IsoDate,
  IsoDateTime,
  Macros,
  MealType,
  NutritionEstimateSource
} from "@/domain/types";

export const mealTypes: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
export const nutritionEstimateSources: NutritionEstimateSource[] = [
  "manual",
  "photo_ai",
  "barcode",
  "restaurant_db"
];
export const estimateConfidences: EstimateConfidence[] = ["low", "medium", "high"];

export type FoodEntryInput = {
  date: IsoDate;
  mealType: MealType;
  description: string;
  macros?: Macros;
  estimateSource?: NutritionEstimateSource;
  confidence?: EstimateConfidence;
  photoRef?: string;
};

export type FoodEntryValidationResult =
  | { ok: true; value: Required<Pick<FoodEntryInput, "date" | "mealType" | "description">> & FoodEntryInput }
  | { ok: false; message: string };

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function optionalNonNegative(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function normalizeMacros(macros: Macros | undefined): Macros {
  return {
    calories: optionalNonNegative(macros?.calories),
    proteinG: optionalNonNegative(macros?.proteinG),
    carbsG: optionalNonNegative(macros?.carbsG),
    fatG: optionalNonNegative(macros?.fatG),
    fiberG: optionalNonNegative(macros?.fiberG),
    sugarG: optionalNonNegative(macros?.sugarG),
    sodiumMg: optionalNonNegative(macros?.sodiumMg)
  };
}

export function validateFoodEntryInput(input: FoodEntryInput): FoodEntryValidationResult {
  const date = input.date?.trim();

  if (!date) {
    return { ok: false, message: "Food entry date is required." };
  }

  if (!mealTypes.includes(input.mealType)) {
    return { ok: false, message: "Meal type is invalid." };
  }

  const description = input.description?.trim();

  if (!description) {
    return { ok: false, message: "Food description is required." };
  }

  const estimateSource =
    input.estimateSource && nutritionEstimateSources.includes(input.estimateSource)
      ? input.estimateSource
      : "manual";

  const confidence =
    input.confidence && estimateConfidences.includes(input.confidence) ? input.confidence : undefined;

  return {
    ok: true,
    value: {
      date,
      mealType: input.mealType,
      description,
      macros: normalizeMacros(input.macros),
      estimateSource,
      confidence,
      photoRef: normalizeOptionalText(input.photoRef)
    }
  };
}

export function createFoodEntry(
  input: FoodEntryInput,
  now: IsoDateTime = new Date().toISOString()
): FoodEntry {
  const validation = validateFoodEntryInput(input);

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const { value } = validation;

  return {
    id: globalThis.crypto?.randomUUID?.() ?? `food-${now}`,
    date: value.date,
    mealType: value.mealType,
    description: value.description,
    macros: value.macros ?? {},
    estimateSource: value.estimateSource ?? "manual",
    confidence: value.confidence,
    photoRef: value.photoRef,
    recordedAt: now,
    createdAt: now,
    updatedAt: now
  };
}

/** Sum macros across many entries (e.g. a day's total). */
export function sumMacros(entries: FoodEntry[]): Required<Macros> {
  return entries.reduce<Required<Macros>>(
    (total, entry) => ({
      calories: total.calories + (entry.macros.calories ?? 0),
      proteinG: total.proteinG + (entry.macros.proteinG ?? 0),
      carbsG: total.carbsG + (entry.macros.carbsG ?? 0),
      fatG: total.fatG + (entry.macros.fatG ?? 0),
      fiberG: total.fiberG + (entry.macros.fiberG ?? 0),
      sugarG: total.sugarG + (entry.macros.sugarG ?? 0),
      sodiumMg: total.sodiumMg + (entry.macros.sodiumMg ?? 0)
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 }
  );
}

/** Net carbs = carbs − fiber (floored at 0). Relevant for glucose management. */
export function netCarbs(macros: Macros): number {
  return Math.max(0, (macros.carbsG ?? 0) - (macros.fiberG ?? 0));
}

/** A single day's food entries, newest first. */
export function getFoodEntriesForDate(entries: FoodEntry[], date: IsoDate): FoodEntry[] {
  return entries
    .filter((entry) => entry.date === date)
    .sort((a, b) => (b.recordedAt > a.recordedAt ? 1 : -1));
}

/** Group a day's entries by meal, in display order. */
export function groupEntriesByMeal(entries: FoodEntry[]): Record<MealType, FoodEntry[]> {
  const grouped: Record<MealType, FoodEntry[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: []
  };
  for (const entry of entries) {
    grouped[entry.mealType].push(entry);
  }
  return grouped;
}

/** Calories left in the day's budget (can go negative when over budget). */
export function caloriesRemaining(
  calorieTarget: number | undefined,
  consumedCalories: number
): number | undefined {
  if (calorieTarget === undefined) {
    return undefined;
  }
  return Math.round(calorieTarget - consumedCalories);
}

export function isFoodEntry(value: unknown): value is FoodEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<FoodEntry>;

  return (
    typeof entry.id === "string" &&
    typeof entry.date === "string" &&
    entry.mealType !== undefined &&
    mealTypes.includes(entry.mealType) &&
    typeof entry.description === "string" &&
    entry.description.trim().length > 0 &&
    typeof entry.macros === "object" &&
    entry.macros !== null &&
    typeof entry.recordedAt === "string" &&
    typeof entry.createdAt === "string" &&
    typeof entry.updatedAt === "string"
  );
}
