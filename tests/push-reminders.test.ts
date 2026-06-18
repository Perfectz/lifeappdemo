import { describe, expect, it } from "vitest";

import type { MetricEntry } from "@/domain";
import { getDueReminders } from "@/domain/pushReminders";
import { createWorkout } from "@/domain/workouts";

const today = "2026-06-17";

function metric(extra: Partial<MetricEntry>): MetricEntry {
  return {
    id: "m",
    date: today,
    checkInType: "freeform",
    source: "manual",
    recordedAt: `${today}T07:00:00.000Z`,
    createdAt: `${today}T07:00:00.000Z`,
    updatedAt: `${today}T07:00:00.000Z`,
    ...extra
  };
}

describe("push reminders", () => {
  it("fires the vitals reminder just after 7:30 when vitals aren't logged", () => {
    const due = getDueReminders({ today, nowMinutes: 7 * 60 + 31, metrics: [], workouts: [] });
    expect(due.map((d) => d.id)).toEqual(["vitals"]);
  });

  it("does not fire vitals once a vitals value is logged", () => {
    const due = getDueReminders({
      today,
      nowMinutes: 7 * 60 + 31,
      metrics: [metric({ weightLbs: 184 })],
      workouts: []
    });
    expect(due).toEqual([]);
  });

  it("only fires within the window after the deadline", () => {
    // 8:30 is 60 min past 7:30 — outside the 30-min window.
    const due = getDueReminders({ today, nowMinutes: 8 * 60 + 30, metrics: [], workouts: [] });
    expect(due).toEqual([]);
  });

  it("fires the first-workout reminder at 9am when none are logged", () => {
    const due = getDueReminders({
      today,
      nowMinutes: 9 * 60,
      metrics: [metric({ weightLbs: 184 })],
      workouts: []
    });
    expect(due.map((d) => d.id)).toEqual(["workout-1"]);
  });

  it("does not fire the first-workout reminder once one workout is done", () => {
    const due = getDueReminders({
      today,
      nowMinutes: 9 * 60,
      metrics: [metric({ weightLbs: 184 })],
      workouts: [createWorkout({ date: today, type: "cardio" }, `${today}T08:00:00.000Z`)]
    });
    expect(due).toEqual([]);
  });

  it("fires the third-workout reminder at 9pm when fewer than three are done", () => {
    const due = getDueReminders({
      today,
      nowMinutes: 21 * 60,
      metrics: [metric({ weightLbs: 184 })],
      workouts: [
        createWorkout({ date: today, type: "cardio" }, `${today}T08:00:00.000Z`),
        createWorkout({ date: today, type: "strength" }, `${today}T12:00:00.000Z`)
      ]
    });
    expect(due.map((d) => d.id)).toEqual(["workout-3"]);
  });
});
