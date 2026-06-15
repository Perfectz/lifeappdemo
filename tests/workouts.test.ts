import { describe, expect, it } from "vitest";

import { createWorkout, isWorkout, validateWorkoutInput } from "@/domain/workouts";

const now = "2026-06-15T08:00:00.000Z";

describe("workouts domain", () => {
  it("creates a strength workout with sets, equipment, and timestamps", () => {
    const workout = createWorkout(
      {
        date: "2026-06-15",
        type: "strength",
        title: "Day 1 — Chest & Biceps",
        equipment: ["adjustable_dumbbells", "adjustable_bench"],
        sets: [{ exercise: "Flat Dumbbell Bench Press", weightLbs: 40 }]
      },
      now
    );

    expect(workout).toMatchObject({
      date: "2026-06-15",
      type: "strength",
      source: "manual",
      recordedAt: now,
      createdAt: now,
      updatedAt: now
    });
    expect(workout.sets).toEqual([{ exercise: "Flat Dumbbell Bench Press", weightLbs: 40 }]);
  });

  it("rejects missing date and invalid type", () => {
    expect(validateWorkoutInput({ date: "", type: "cardio" }).ok).toBe(false);
    expect(
      validateWorkoutInput({ date: "2026-06-15", type: "yoga" as never }).ok
    ).toBe(false);
  });

  it("clamps overall RPE to 1-10", () => {
    expect(createWorkout({ date: "2026-06-15", type: "cardio", intensityRpe: 99 }, now).intensityRpe).toBe(10);
    expect(createWorkout({ date: "2026-06-15", type: "cardio", intensityRpe: -4 }, now).intensityRpe).toBe(1);
  });

  it("drops sets with empty exercise names and filters invalid equipment", () => {
    const workout = createWorkout(
      {
        date: "2026-06-15",
        type: "strength",
        sets: [{ exercise: "  " }, { exercise: "Goblet Squat" }],
        equipment: ["kettlebell", "barbell" as never]
      },
      now
    );
    expect(workout.sets).toEqual([{ exercise: "Goblet Squat" }]);
    expect(workout.equipment).toEqual(["kettlebell"]);
  });

  it("guards workout shape", () => {
    const workout = createWorkout({ date: "2026-06-15", type: "cardio" }, now);
    expect(isWorkout(workout)).toBe(true);
    expect(isWorkout({ id: "x", date: "2026-06-15" })).toBe(false);
    expect(isWorkout(null)).toBe(false);
  });
});
