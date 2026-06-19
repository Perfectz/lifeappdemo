import type { IsoDateTime } from "@/domain/types";

/**
 * Daily nutrition targets (calorie budget + macro goals), à la LoseIt /
 * MyFitnessPal / MyNetDiary. Calorie + macro targets are personal, so they
 * start empty and are set in-app — never committed to source. Water has a
 * generic default. Stored locally and synced via the generic snapshot.
 */
export type NutritionGoals = {
  calorieTarget?: number;
  proteinTargetG?: number;
  carbsTargetG?: number;
  fatTargetG?: number;
  waterTargetOz: number;
  updatedAt: IsoDateTime;
};

export const DEFAULT_NUTRITION_GOALS: Omit<NutritionGoals, "updatedAt"> = {
  waterTargetOz: 64
};

export function defaultNutritionGoals(now: IsoDateTime = new Date().toISOString()): NutritionGoals {
  return { ...DEFAULT_NUTRITION_GOALS, updatedAt: now };
}

function isPositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isOptionalPositive(value: unknown): boolean {
  return value === undefined || isPositive(value);
}

export function isNutritionGoals(value: unknown): value is NutritionGoals {
  if (!value || typeof value !== "object") {
    return false;
  }
  const goals = value as Partial<NutritionGoals>;
  return (
    isPositive(goals.waterTargetOz) &&
    isOptionalPositive(goals.calorieTarget) &&
    isOptionalPositive(goals.proteinTargetG) &&
    isOptionalPositive(goals.carbsTargetG) &&
    isOptionalPositive(goals.fatTargetG) &&
    typeof goals.updatedAt === "string"
  );
}

export function withNutritionGoalEdits(
  current: NutritionGoals,
  edits: Partial<Omit<NutritionGoals, "updatedAt">>,
  now: IsoDateTime = new Date().toISOString()
): NutritionGoals {
  return { ...current, ...edits, updatedAt: now };
}
