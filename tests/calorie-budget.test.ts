import { describe, expect, it } from "vitest";

import { computeCalorieBudget } from "@/domain/calorieBudget";

describe("calorie budget", () => {
  it("computes BMR/TDEE and a deficit for weight loss", () => {
    const result = computeCalorieBudget({
      sex: "male",
      age: 41,
      heightInches: 71,
      weightLbs: 230,
      targetWeightLbs: 195,
      activityLevel: "light",
      goal: "lose"
    });
    // Mifflin-St Jeor for these stats lands BMR ~1950 and TDEE ~2680.
    expect(result.bmr).toBeGreaterThan(1800);
    expect(result.bmr).toBeLessThan(2100);
    expect(result.tdee).toBeGreaterThan(result.bmr);
    expect(result.recommendedCalories).toBe(result.tdee - 500);
    // protein anchored to target weight (~0.8 g/lb)
    expect(result.proteinTargetG).toBe(Math.round(195 * 0.8));
    expect(result.carbsTargetG).toBeGreaterThanOrEqual(0);
  });

  it("does not subtract a deficit when maintaining", () => {
    const result = computeCalorieBudget({
      sex: "female",
      age: 35,
      heightInches: 65,
      weightLbs: 150,
      activityLevel: "moderate",
      goal: "maintain"
    });
    expect(result.recommendedCalories).toBe(result.tdee);
  });

  it("floors calories at a safe minimum", () => {
    const result = computeCalorieBudget({
      sex: "female",
      age: 70,
      heightInches: 60,
      weightLbs: 110,
      activityLevel: "sedentary",
      goal: "lose"
    });
    expect(result.recommendedCalories).toBeGreaterThanOrEqual(1200);
  });
});
