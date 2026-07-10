import { describe, expect, it } from "vitest";

import type { DailyPlan, MetricEntry } from "@/domain";
import { buildDailyBrief, type DailyBriefInput } from "@/domain/dailyBrief";
import { createWorkout } from "@/domain/workouts";
import { createFoodEntry } from "@/domain/nutrition";
import { createTask } from "@/domain/tasks";

const today = "2026-06-17";

function base(overrides: Partial<DailyBriefInput> = {}): DailyBriefInput {
  return {
    today,
    nowMinutes: 9 * 60,
    tasks: [],
    workouts: [],
    metrics: [],
    dailyPlans: [],
    ...overrides
  };
}

function metricToday(extra: Partial<MetricEntry>): MetricEntry {
  return {
    id: "m1",
    date: today,
    checkInType: "freeform",
    source: "manual",
    recordedAt: `${today}T08:00:00.000Z`,
    createdAt: `${today}T08:00:00.000Z`,
    updatedAt: `${today}T08:00:00.000Z`,
    ...extra
  };
}

const planToday: DailyPlan = {
  id: "p1",
  date: today,
  sideQuestTaskIds: [],
  status: "planned",
  createdAt: `${today}T07:00:00.000Z`,
  updatedAt: `${today}T07:00:00.000Z`
};

describe("daily brief", () => {
  it("flags vitals, fitness, and morning plan when the day is empty", () => {
    const brief = buildDailyBrief(base());
    expect(brief.timeOfDay).toBe("morning");
    expect(brief.allClear).toBe(false);
    expect(brief.focus.map((f) => f.id)).toEqual(["vitals", "fitness", "morning"]);
    // The top focus is vitals, with a CTA to the vitals screen.
    expect(brief.focus[0]).toMatchObject({ ctaLabel: "Log vitals", href: "/vitals" });
  });

  it("is all-clear when vitals, all workouts, and the plan are done", () => {
    const brief = buildDailyBrief(
      base({
        nowMinutes: 10 * 60,
        metrics: [metricToday({ weightLbs: 184 })],
        workouts: [
          createWorkout({ date: today, type: "strength" }, `${today}T06:00:00.000Z`),
          createWorkout({ date: today, type: "cardio" }, `${today}T07:00:00.000Z`),
          createWorkout({ date: today, type: "martial_arts" }, `${today}T18:00:00.000Z`)
        ],
        dailyPlans: [planToday]
      })
    );
    expect(brief.allClear).toBe(true);
    expect(brief.focus).toEqual([]);
  });

  it("marks the fitness item overdue when behind the workout windows", () => {
    // 10:00am, past the 9am first-workout deadline, with nothing logged.
    const brief = buildDailyBrief(base({ nowMinutes: 10 * 60, metrics: [metricToday({ weightLbs: 184 })] }));
    const fitness = brief.focus.find((item) => item.id === "fitness");
    expect(fitness?.overdue).toBe(true);
  });

  it("drops the vitals item once a vitals value is logged today", () => {
    const brief = buildDailyBrief({
      ...base(),
      metrics: [metricToday({ bloodGlucoseMgDl: 95 })]
    });
    expect(brief.focus.map((f) => f.id)).not.toContain("vitals");
  });

  it("is all-clear in the evening when vitals, workouts, and the plan are done", () => {
    const brief = buildDailyBrief(
      base({
        nowMinutes: 20 * 60,
        metrics: [metricToday({ weightLbs: 184 })],
        workouts: [
          createWorkout({ date: today, type: "strength" }, `${today}T06:00:00.000Z`),
          createWorkout({ date: today, type: "cardio" }, `${today}T07:00:00.000Z`),
          createWorkout({ date: today, type: "martial_arts" }, `${today}T18:00:00.000Z`)
        ],
        dailyPlans: [planToday]
      })
    );
    expect(brief.timeOfDay).toBe("evening");
    expect(brief.allClear).toBe(true);
    expect(brief.focus).toEqual([]);
  });

  it("treats a scheduled recovery day as complete without workouts", () => {
    const brief = buildDailyBrief(
      base({
        metrics: [metricToday({ weightLbs: 184 })],
        dailyPlans: [planToday],
        requiredWorkoutTypes: []
      })
    );
    expect(brief.focus.map((item) => item.id)).not.toContain("fitness");
  });

  it("surfaces overdue quests, protein, and water in the afternoon", () => {
    const brief = buildDailyBrief(
      base({
        nowMinutes: 14 * 60,
        tasks: [
          createTask(
            { title: "Book appointment", priority: "high", tags: ["health"], dueDate: "2026-06-16" },
            `${today}T08:00:00.000Z`
          )
        ],
        metrics: [metricToday({ weightLbs: 184 })],
        workouts: [
          createWorkout({ date: today, type: "strength" }, `${today}T06:00:00.000Z`),
          createWorkout({ date: today, type: "cardio" }, `${today}T07:00:00.000Z`),
          createWorkout({ date: today, type: "martial_arts" }, `${today}T08:00:00.000Z`)
        ],
        dailyPlans: [planToday],
        foodEntries: [
          createFoodEntry({ date: today, mealType: "breakfast", description: "Toast", macros: { proteinG: 5 } })
        ],
        nutritionTarget: {
          date: today,
          calorieTarget: 2000,
          proteinTargetG: 150,
          carbsTargetG: 200,
          fatTargetG: 70,
          rationale: "test",
          source: "computed",
          createdAt: `${today}T06:00:00.000Z`
        },
        waterOz: 8
      })
    );
    expect(brief.focus.map((item) => item.id)).toEqual(["overdue-quests", "protein", "water"]);
  });
});
