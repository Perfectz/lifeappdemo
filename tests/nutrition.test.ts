import { describe, expect, it } from "vitest";

import {
  caloriesRemaining,
  createFoodEntry,
  getFoodEntriesForDate,
  groupEntriesByMeal,
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
    expect(sumMacros([a, b])).toEqual({ calories: 1000, proteinG: 70, carbsG: 60, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 });
  });

  it("guards food-entry shape", () => {
    expect(isFoodEntry(createFoodEntry({ date: "2026-06-15", mealType: "snack", description: "nuts" }, now))).toBe(true);
    expect(isFoodEntry({ id: "x", description: "nuts" })).toBe(false);
  });

  it("filters a day's entries and groups them by meal", () => {
    const entries = [
      createFoodEntry({ date: "2026-06-15", mealType: "breakfast", description: "eggs" }, now),
      createFoodEntry({ date: "2026-06-15", mealType: "lunch", description: "salad" }, now),
      createFoodEntry({ date: "2026-06-14", mealType: "dinner", description: "old" }, now)
    ];
    const day = getFoodEntriesForDate(entries, "2026-06-15");
    expect(day).toHaveLength(2);
    const grouped = groupEntriesByMeal(day);
    expect(grouped.breakfast).toHaveLength(1);
    expect(grouped.lunch[0].description).toBe("salad");
    expect(grouped.dinner).toHaveLength(0);
  });

  it("computes calories remaining against a budget", () => {
    expect(caloriesRemaining(2000, 1400)).toBe(600);
    expect(caloriesRemaining(2000, 2300)).toBe(-300);
    expect(caloriesRemaining(undefined, 1400)).toBeUndefined();
  });
});
