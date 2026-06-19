import { describe, expect, it } from "vitest";

import { getNutritionTrend } from "@/domain/nutritionTrend";
import { createFoodEntry } from "@/domain/nutrition";

const today = "2026-06-18";

function food(date: string, calories: number, proteinG = 0) {
  return createFoodEntry({ date, mealType: "lunch", description: "x", macros: { calories, proteinG } });
}

describe("nutrition trend", () => {
  it("builds one point per day across the window, oldest first", () => {
    const trend = getNutritionTrend([], today, 14);
    expect(trend.points).toHaveLength(14);
    expect(trend.points[0].date).toBe("2026-06-05");
    expect(trend.points[13].date).toBe(today);
    expect(trend.daysLogged).toBe(0);
    expect(trend.avgCalories).toBeUndefined();
  });

  it("sums per-day totals and averages only logged days", () => {
    const foods = [
      food(today, 600, 40),
      food(today, 400, 20),
      food("2026-06-17", 1000, 60)
    ];
    const trend = getNutritionTrend(foods, today, 14);
    expect(trend.daysLogged).toBe(2);
    expect(trend.points[13].calories).toBe(1000); // today: 600 + 400
    expect(trend.avgCalories).toBe(1000); // (1000 + 1000) / 2
    expect(trend.avgProteinG).toBe(60); // (60 + 60) / 2
  });

  it("ignores entries outside the window", () => {
    const trend = getNutritionTrend([food("2026-01-01", 500)], today, 14);
    expect(trend.daysLogged).toBe(0);
  });
});
