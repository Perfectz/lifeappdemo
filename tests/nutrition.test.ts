import { describe, expect, it } from "vitest";

import {
  createFoodEntry,
  isFoodEntry,
  sumMacros,
  validateFoodEntryInput
} from "@/domain/nutrition";

const now = "2026-06-15T12:00:00.000Z";

describe("nutrition domain", () => {
  it("creates a food entry with macros and timestamps", () => {
    const entry = createFoodEntry(
      {
        date: "2026-06-15",
        mealType: "lunch",
        description: "Chicken bowl",
        macros: { calories: 600, proteinG: 45 },
        estimateSource: "photo_ai",
        confidence: "medium"
      },
      now
    );
    expect(entry).toMatchObject({
      mealType: "lunch",
      description: "Chicken bowl",
      estimateSource: "photo_ai",
      confidence: "medium",
      recordedAt: now
    });
    expect(entry.macros.calories).toBe(600);
  });

  it("rejects empty description and invalid meal type", () => {
    expect(validateFoodEntryInput({ date: "2026-06-15", mealType: "lunch", description: "  " }).ok).toBe(false);
    expect(validateFoodEntryInput({ date: "2026-06-15", mealType: "brunch" as never, description: "x" }).ok).toBe(false);
  });

  it("sums macros across entries", () => {
    const a = createFoodEntry({ date: "2026-06-15", mealType: "breakfast", description: "a", macros: { calories: 300, proteinG: 20 } }, now);
    const b = createFoodEntry({ date: "2026-06-15", mealType: "dinner", description: "b", macros: { calories: 700, proteinG: 50, carbsG: 60 } }, now);
    expect(sumMacros([a, b])).toEqual({ calories: 1000, proteinG: 70, carbsG: 60, fatG: 0, fiberG: 0 });
  });

  it("guards food-entry shape", () => {
    expect(isFoodEntry(createFoodEntry({ date: "2026-06-15", mealType: "snack", description: "nuts" }, now))).toBe(true);
    expect(isFoodEntry({ id: "x", description: "nuts" })).toBe(false);
  });
});
