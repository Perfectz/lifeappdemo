import { describe, expect, it } from "vitest";

import { getDailyFitnessStatus } from "@/domain/dailyFitness";
import { createWorkout } from "@/domain/workouts";

const day = "2026-06-15";

describe("daily fitness status", () => {
  it("reports zero complete when nothing is logged", () => {
    const status = getDailyFitnessStatus([], day);
    expect(status.completedCount).toBe(0);
    expect(status.isComplete).toBe(false);
    expect(status.byType.strength).toBeUndefined();
  });

  it("is complete when all three session types are logged for the day", () => {
    const workouts = [
      createWorkout({ date: day, type: "strength" }, "2026-06-15T08:00:00.000Z"),
      createWorkout({ date: day, type: "cardio" }, "2026-06-15T09:00:00.000Z"),
      createWorkout({ date: day, type: "martial_arts" }, "2026-06-15T18:00:00.000Z")
    ];
    const status = getDailyFitnessStatus(workouts, day);
    expect(status.completedCount).toBe(3);
    expect(status.isComplete).toBe(true);
  });

  it("ignores other days and keeps the most recent per type", () => {
    const workouts = [
      createWorkout({ date: "2026-06-14", type: "cardio", title: "Yesterday" }, "2026-06-14T09:00:00.000Z"),
      createWorkout({ date: day, type: "cardio", title: "Morning walk" }, "2026-06-15T07:00:00.000Z"),
      createWorkout({ date: day, type: "cardio", title: "Evening run" }, "2026-06-15T19:00:00.000Z")
    ];
    const status = getDailyFitnessStatus(workouts, day);
    expect(status.completedCount).toBe(1);
    expect(status.byType.cardio?.title).toBe("Evening run");
  });
});
