import { describe, expect, it } from "vitest";

import type { DailyNutritionTarget } from "@/domain/dailyNutritionTarget";
import type { DailyPlan, FoodEntry, MetricEntry, Task } from "@/domain/types";
import {
  buildHealthQuestSuggestions,
  MAX_SUGGESTIONS,
  type HealthQuestSuggestionsInput
} from "@/domain/healthQuestSuggestions";
import { createWorkout } from "@/domain/workouts";

const today = "2026-06-17";
const now = `${today}T08:00:00.000Z`;

function base(overrides: Partial<HealthQuestSuggestionsInput> = {}): HealthQuestSuggestionsInput {
  return {
    today,
    nowMinutes: 8 * 60,
    metrics: [],
    workouts: [],
    foodEntries: [],
    target: undefined,
    waterOz: 0,
    openTasks: [],
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
    recordedAt: now,
    createdAt: now,
    updatedAt: now,
    ...extra
  };
}

function foodToday(proteinG: number): FoodEntry {
  return {
    id: `food-${proteinG}`,
    date: today,
    mealType: "lunch",
    description: "meal",
    macros: { proteinG },
    estimateSource: "manual",
    recordedAt: now,
    createdAt: now,
    updatedAt: now
  };
}

function targetToday(proteinTargetG: number): DailyNutritionTarget {
  return {
    date: today,
    calorieTarget: 2100,
    proteinTargetG,
    carbsTargetG: 200,
    fatTargetG: 70,
    rationale: "test",
    source: "computed",
    createdAt: now
  };
}

function openTask(title: string, extra: Partial<Task> = {}): Task {
  return {
    id: `task-${title}`,
    title,
    status: "todo",
    priority: "medium",
    tags: ["health"],
    plannedForDate: today,
    createdAt: now,
    updatedAt: now,
    ...extra
  };
}

const planToday: DailyPlan = {
  id: "p1",
  date: today,
  sideQuestTaskIds: [],
  status: "planned",
  createdAt: now,
  updatedAt: now
};

function keys(input: HealthQuestSuggestionsInput): string[] {
  return buildHealthQuestSuggestions(input).map((s) => s.key);
}

describe("health quest suggestions", () => {
  describe("morning vitals", () => {
    it("suggests logging vitals when absent past 7:30", () => {
      const suggestions = buildHealthQuestSuggestions(base());
      const vitals = suggestions.find((s) => s.key === "vitals");
      expect(vitals).toMatchObject({
        title: "Log morning vitals",
        priority: "high",
        tag: "health"
      });
      expect(vitals?.reason).toContain("7:30am");
    });

    it("does not suggest vitals before 7:30", () => {
      expect(keys(base({ nowMinutes: 7 * 60 }))).not.toContain("vitals");
    });

    it("does not suggest vitals once any vital is logged today", () => {
      expect(keys(base({ metrics: [metricToday({ bloodGlucoseMgDl: 96 })] }))).not.toContain(
        "vitals"
      );
      expect(keys(base({ metrics: [metricToday({ weightLbs: 184 })] }))).not.toContain("vitals");
    });
  });

  describe("training sessions", () => {
    it("suggests each missing session with the rolling deadlines", () => {
      // 10:00 — first (9am) deadline has passed with nothing logged.
      const suggestions = buildHealthQuestSuggestions(
        base({ nowMinutes: 10 * 60, metrics: [metricToday({ weightLbs: 184 })] })
      );
      const strength = suggestions.find((s) => s.key === "session-strength");
      const cardio = suggestions.find((s) => s.key === "session-cardio");
      const martial = suggestions.find((s) => s.key === "session-martial_arts");
      expect(strength).toMatchObject({ title: "Strength session", priority: "high" });
      expect(cardio).toMatchObject({ title: "Cardio session", priority: "medium" });
      expect(martial).toMatchObject({ title: "Martial arts session", priority: "medium" });
    });

    it("skips sessions already logged as workouts", () => {
      const suggestionKeys = keys(
        base({
          nowMinutes: 10 * 60,
          workouts: [createWorkout({ date: today, type: "strength" }, now)]
        })
      );
      expect(suggestionKeys).not.toContain("session-strength");
      expect(suggestionKeys).toContain("session-cardio");
    });

    it("counts a karate class check-in as the martial arts session", () => {
      const suggestionKeys = keys(
        base({ nowMinutes: 10 * 60, metrics: [metricToday({ karateClass: true })] })
      );
      expect(suggestionKeys).not.toContain("session-martial_arts");
      expect(suggestionKeys).toContain("session-strength");
    });

    it("suggests nothing when all three sessions are done", () => {
      const suggestionKeys = keys(
        base({
          nowMinutes: 22 * 60,
          metrics: [metricToday({ weightLbs: 184, karateClass: true })],
          workouts: [
            createWorkout({ date: today, type: "strength" }, now),
            createWorkout({ date: today, type: "cardio" }, now)
          ],
          waterOz: 64,
          dailyPlans: [planToday]
        })
      );
      expect(suggestionKeys).toEqual([]);
    });
  });

  describe("protein target", () => {
    const covered = base({
      nowMinutes: 14 * 60,
      metrics: [metricToday({ weightLbs: 184 })],
      target: targetToday(150),
      waterOz: 64,
      dailyPlans: [planToday]
    });

    it("suggests protein past midday when logged protein is under 60% of target", () => {
      const suggestions = buildHealthQuestSuggestions({
        ...covered,
        foodEntries: [foodToday(80)]
      });
      const protein = suggestions.find((s) => s.key === "protein");
      expect(protein).toMatchObject({ title: "Hit your protein target", priority: "medium" });
      expect(protein?.reason).toContain("80g");
      expect(protein?.reason).toContain("150g");
    });

    it("does not suggest protein at or above 60% of target", () => {
      expect(keys({ ...covered, foodEntries: [foodToday(90)] })).not.toContain("protein");
    });

    it("does not suggest protein before midday", () => {
      expect(
        keys({ ...covered, nowMinutes: 11 * 60, foodEntries: [foodToday(10)] })
      ).not.toContain("protein");
    });

    it("does not suggest protein without a daily target", () => {
      expect(keys({ ...covered, target: undefined, foodEntries: [foodToday(10)] })).not.toContain(
        "protein"
      );
    });
  });

  describe("water", () => {
    it("suggests the remaining ounces past midday when under half the goal", () => {
      const suggestions = buildHealthQuestSuggestions(base({ nowMinutes: 14 * 60, waterOz: 10 }));
      const water = suggestions.find((s) => s.key === "water");
      expect(water?.title).toBe("Drink water — 54 oz to go");
      expect(water?.priority).toBe("medium");
    });

    it("does not suggest water at or above half the goal", () => {
      expect(keys(base({ nowMinutes: 14 * 60, waterOz: 32 }))).not.toContain("water");
    });

    it("does not suggest water before midday", () => {
      expect(keys(base({ nowMinutes: 9 * 60, waterOz: 0 }))).not.toContain("water");
    });
  });

  describe("daily plan", () => {
    it("suggests planning the day when no plan exists", () => {
      const plan = buildHealthQuestSuggestions(base({ nowMinutes: 7 * 60 })).find(
        (s) => s.key === "plan"
      );
      expect(plan).toMatchObject({ title: "Plan your day", tag: "health" });
    });

    it("does not suggest planning once today has a plan", () => {
      expect(keys(base({ dailyPlans: [planToday] }))).not.toContain("plan");
    });
  });

  describe("dedupe against open tasks", () => {
    it("skips a suggestion when an open same-day task has the same title", () => {
      const suggestionKeys = keys(
        base({ nowMinutes: 10 * 60, openTasks: [openTask("Strength session")] })
      );
      expect(suggestionKeys).not.toContain("session-strength");
      expect(suggestionKeys).toContain("session-cardio");
    });

    it("matches titles case-insensitively", () => {
      expect(
        keys(base({ nowMinutes: 10 * 60, openTasks: [openTask("strength SESSION")] }))
      ).not.toContain("session-strength");
    });

    it("still suggests when the matching task is done or from another day", () => {
      expect(
        keys(
          base({
            nowMinutes: 10 * 60,
            openTasks: [openTask("Strength session", { status: "done" })]
          })
        )
      ).toContain("session-strength");
      expect(
        keys(
          base({
            nowMinutes: 10 * 60,
            openTasks: [
              openTask("Strength session", {
                plannedForDate: "2026-06-10",
                createdAt: "2026-06-10T08:00:00.000Z"
              })
            ]
          })
        )
      ).toContain("session-strength");
    });

    it("dedupes water on its stable prefix even when the remaining ounces changed", () => {
      // Accepted at 54 oz to go; user drank since, so today's title would differ.
      expect(
        keys(
          base({
            nowMinutes: 14 * 60,
            waterOz: 20,
            openTasks: [openTask("Drink water — 54 oz to go")]
          })
        )
      ).not.toContain("water");
    });

    it("dedupes an accepted vitals quest", () => {
      expect(keys(base({ openTasks: [openTask("Log morning vitals")] }))).not.toContain("vitals");
    });
  });

  describe("cap and ordering", () => {
    it("caps at 4, most urgent first (overdue vitals, then overdue sessions)", () => {
      // 7pm, nothing done all day: vitals overdue, two session slots overdue,
      // martial arts still has its 9pm window, protein/water/plan all pending.
      const suggestions = buildHealthQuestSuggestions(
        base({ nowMinutes: 19 * 60, target: targetToday(150) })
      );
      expect(suggestions).toHaveLength(MAX_SUGGESTIONS);
      expect(suggestions.map((s) => s.key)).toEqual([
        "vitals",
        "session-strength",
        "session-cardio",
        "protein"
      ]);
      expect(suggestions[0].priority).toBe("high");
    });

    it("promotes calmer suggestions once urgent ones are handled", () => {
      const suggestions = buildHealthQuestSuggestions(
        base({
          nowMinutes: 19 * 60,
          target: targetToday(150),
          metrics: [metricToday({ weightLbs: 184 })],
          workouts: [
            createWorkout({ date: today, type: "strength" }, now),
            createWorkout({ date: today, type: "cardio" }, now)
          ]
        })
      );
      // Martial arts (not yet due) sorts after protein/water/plan.
      expect(suggestions.map((s) => s.key)).toEqual([
        "protein",
        "water",
        "plan",
        "session-martial_arts"
      ]);
      expect(suggestions.every((s) => s.tag === "health")).toBe(true);
    });
  });
});
