/**
 * The AI's itemized nutrition read of a meal photo. Tolerant parsing so a
 * slightly-off model response never crashes the diary. Every macro is optional
 * (the model may only be confident about some), but each item has a name.
 */

export const mealEstimateConfidences = ["low", "medium", "high"] as const;
export type MealEstimateConfidence = (typeof mealEstimateConfidences)[number];

export type MealEstimateItem = {
  description: string;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
};

export type MealEstimate = {
  summary: string;
  confidence: MealEstimateConfidence;
  question?: string;
  items: MealEstimateItem[];
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asPositive(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : undefined;
}

function parseItem(value: unknown): MealEstimateItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const description = asString(record.description) || asString(record.name) || asString(record.food);
  if (!description) {
    return null;
  }
  return {
    description,
    calories: asPositive(record.calories),
    proteinG: asPositive(record.proteinG),
    carbsG: asPositive(record.carbsG),
    fatG: asPositive(record.fatG),
    fiberG: asPositive(record.fiberG),
    sugarG: asPositive(record.sugarG),
    sodiumMg: asPositive(record.sodiumMg)
  };
}

export function parseMealEstimate(value: unknown): MealEstimate {
  const record = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const confidenceRaw = asString(record.confidence).toLowerCase();
  const confidence: MealEstimateConfidence = mealEstimateConfidences.includes(
    confidenceRaw as MealEstimateConfidence
  )
    ? (confidenceRaw as MealEstimateConfidence)
    : "low";

  const items = Array.isArray(record.items)
    ? record.items.map(parseItem).filter((item): item is MealEstimateItem => item !== null).slice(0, 20)
    : [];

  return {
    summary: asString(record.summary) || (items.length ? "Estimated this meal." : "Couldn't read that photo."),
    confidence,
    question: asString(record.question) || undefined,
    items
  };
}

/** Total calories across estimated items (for the confirm button label). */
export function sumEstimateCalories(items: MealEstimateItem[]): number {
  return items.reduce((total, item) => total + (item.calories ?? 0), 0);
}
