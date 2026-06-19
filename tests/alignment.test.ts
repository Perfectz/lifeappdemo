import { describe, expect, it } from "vitest";

import { computeDailyAlignment } from "@/domain/alignment";
import { defaultHealthGoals } from "@/domain/healthGoals";
import { defaultNutritionGoals, withNutritionGoalEdits } from "@/domain/nutritionGoals";
import { createFoodEntry } from "@/domain/nutrition";
import type { MetricEntry, Workout } from "@/domain";

const today = "2026-06-18";
const goals = defaultHealthGoals();

function metric(overrides: Partial<MetricEntry>): MetricEntry {
  return {
    id: overrides.id ?? "m1",
    date: overrides.date ?? today,
    checkInType: "morning",
    source: "manual",
    recordedAt: overrides.recordedAt ?? `${today}T08:00:00.000Z`,
    createdAt: `${today}T08:00:00.000Z`,
    updatedAt: `${today}T08:00:00.000Z`,
    ...overrides
  };
}

function workout(type: Workout["type"]): Workout {
  return {
    id: `w-${type}`,
    date: today,
    type,
    title: type,
    durationMinutes: 30,
    recordedAt: `${today}T10:00:00.000Z`,
    createdAt: `${today}T10:00:00.000Z`,
    updatedAt: `${today}T10:00:00.000Z`
  } as Workout;
}

describe("daily alignment", () => {
  it("scores zero with nothing logged (no calorie budget set)", () => {
    const result = computeDailyAlignment({ today, metrics: [], workouts: [], goals });
    expect(result.score).toBe(0);
    expect(result.percent).toBe(0);
    expect(result.level).toBe("not_started");
    expect(result.max).toBe(115); // calorie_budget only counts once a target is set
  });

  it("awards points for in-range vitals and all three sessions", () => {
    const metrics = [
      metric({
        bloodGlucoseMgDl: 95,
        glucoseContext: "fasting",
        bloodPressureSystolic: 122,
        bloodPressureDiastolic: 78,
        weightLbs: 220
      })
    ];
    const workouts = [workout("strength"), workout("cardio"), workout("martial_arts")];
    const result = computeDailyAlignment({ today, metrics, workouts, goals });
    // 50 vitals + 50 sessions = 100; no sleep/food logged.
    expect(result.score).toBe(100);
    expect(result.level).toBe("strongly_aligned");
  });

  it("counts sleep, food logging, and calorie budget when provided", () => {
    const metrics = [
      metric({
        bloodGlucoseMgDl: 95,
        glucoseContext: "fasting",
        bloodPressureSystolic: 122,
        bloodPressureDiastolic: 78,
        weightLbs: 220,
        sleepHours: 8
      })
    ];
    const workouts = [workout("strength"), workout("cardio"), workout("martial_arts")];
    const foods = [
      createFoodEntry({ date: today, mealType: "lunch", description: "bowl", macros: { calories: 500 } })
    ];
    const nutritionGoals = withNutritionGoalEdits(defaultNutritionGoals(), { calorieTarget: 2000 });
    const result = computeDailyAlignment({ today, metrics, workouts, goals, foods, nutritionGoals });
    expect(result.max).toBe(125);
    expect(result.score).toBe(125);
    expect(result.percent).toBe(100);
  });

  it("gives logging credit but withholds in-range points when vitals are high", () => {
    const metrics = [
      metric({
        bloodGlucoseMgDl: 180,
        glucoseContext: "fasting",
        bloodPressureSystolic: 150,
        bloodPressureDiastolic: 95,
        weightLbs: 220
      })
    ];
    const result = computeDailyAlignment({ today, metrics, workouts: [], goals });
    expect(result.score).toBe(30);
    expect(result.contributions.find((c) => c.key === "bp_in_range")?.earned).toBe(0);
    expect(result.contributions.find((c) => c.key === "glucose_in_range")?.earned).toBe(0);
  });

  it("ignores entries and workouts from other days", () => {
    const metrics = [metric({ id: "old", date: "2026-06-01", weightLbs: 220 })];
    const result = computeDailyAlignment({ today, metrics, workouts: [], goals });
    expect(result.score).toBe(0);
  });
});
