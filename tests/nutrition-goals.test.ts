import { describe, expect, it } from "vitest";

import {
  defaultNutritionGoals,
  isNutritionGoals,
  withNutritionGoalEdits
} from "@/domain/nutritionGoals";

describe("nutrition goals", () => {
  it("defaults water and leaves calorie/macros unset", () => {
    const goals = defaultNutritionGoals("2026-06-18T00:00:00.000Z");
    expect(goals.waterTargetOz).toBe(64);
    expect(goals.calorieTarget).toBeUndefined();
    expect(isNutritionGoals(goals)).toBe(true);
  });

  it("rejects malformed goals", () => {
    expect(isNutritionGoals(null)).toBe(false);
    expect(isNutritionGoals({ waterTargetOz: 0, updatedAt: "x" })).toBe(false);
    expect(isNutritionGoals({ waterTargetOz: 64, calorieTarget: -5, updatedAt: "x" })).toBe(false);
  });

  it("merges edits and stamps updatedAt", () => {
    const base = defaultNutritionGoals("2026-06-18T00:00:00.000Z");
    const next = withNutritionGoalEdits(base, { calorieTarget: 2000, proteinTargetG: 180 }, "2026-06-19T00:00:00.000Z");
    expect(next.calorieTarget).toBe(2000);
    expect(next.proteinTargetG).toBe(180);
    expect(next.waterTargetOz).toBe(64);
    expect(next.updatedAt).toBe("2026-06-19T00:00:00.000Z");
  });
});
