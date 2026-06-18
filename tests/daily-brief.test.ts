import { describe, expect, it } from "vitest";

import type { DailyPlan, EveningPostmortem, MetricEntry } from "@/domain";
import { buildDailyBrief, type DailyBriefInput } from "@/domain/dailyBrief";
import { createWorkout } from "@/domain/workouts";

const today = "2026-06-17";

function base(overrides: Partial<DailyBriefInput> = {}): DailyBriefInput {
  return {
    today,
    hour: 9,
    tasks: [],
    workouts: [],
    metrics: [],
    dailyPlans: [],
    eveningPostmortems: [],
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
        hour: 10,
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

  it("drops the vitals item once a vitals value is logged today", () => {
    const brief = buildDailyBrief({
      ...base(),
      metrics: [metricToday({ bloodGlucoseMgDl: 95 })]
    });
    expect(brief.focus.map((f) => f.id)).not.toContain("vitals");
  });

  it("suggests an evening review in the evening when the plan exists and isn't closed", () => {
    const brief = buildDailyBrief(
      base({
        hour: 20,
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
    expect(brief.focus.map((f) => f.id)).toEqual(["evening"]);
  });

  it("does not suggest an evening review once a postmortem exists", () => {
    const postmortem: EveningPostmortem = {
      id: "pm1",
      date: today,
      taskOutcomes: [],
      createdAt: `${today}T20:00:00.000Z`,
      updatedAt: `${today}T20:00:00.000Z`
    };
    const brief = buildDailyBrief(
      base({
        hour: 21,
        metrics: [metricToday({ weightLbs: 184 })],
        workouts: [
          createWorkout({ date: today, type: "strength" }, `${today}T06:00:00.000Z`),
          createWorkout({ date: today, type: "cardio" }, `${today}T07:00:00.000Z`),
          createWorkout({ date: today, type: "martial_arts" }, `${today}T18:00:00.000Z`)
        ],
        dailyPlans: [planToday],
        eveningPostmortems: [postmortem]
      })
    );
    expect(brief.allClear).toBe(true);
  });
});
