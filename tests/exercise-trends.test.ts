import { describe, expect, it } from "vitest";

import {
  buildExerciseSeries,
  getExerciseSeriesStats,
  listTrackedExercises,
  type ExerciseSeriesPoint
} from "@/domain/exerciseTrends";
import type { StrengthSet, Workout } from "@/domain/types";

const NOW = "2026-07-01T10:00:00.000Z";

function strengthWorkout(date: string, sets: StrengthSet[], id = `w-${date}`): Workout {
  return {
    id,
    date,
    type: "strength",
    source: "manual",
    title: "Session",
    sets,
    recordedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW
  };
}

function cardioWorkout(date: string): Workout {
  return {
    id: `c-${date}`,
    date,
    type: "cardio",
    source: "manual",
    recordedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW
  };
}

describe("listTrackedExercises", () => {
  it("requires at least two distinct session dates with weight and reps", () => {
    const workouts = [
      strengthWorkout("2026-06-01", [{ exercise: "Barbell Bench Press", weightLbs: 185, reps: 5 }]),
      strengthWorkout("2026-06-08", [
        { exercise: "Barbell Bench Press", weightLbs: 190, reps: 5 },
        { exercise: "Dumbbell Curl", weightLbs: 25, reps: 12 }
      ])
    ];
    // Bench has 2 sessions; curls only 1 → excluded.
    expect(listTrackedExercises(workouts)).toEqual(["Barbell Bench Press"]);
  });

  it("does not count two workouts on the same date as two sessions", () => {
    const workouts = [
      strengthWorkout("2026-06-01", [{ exercise: "Squat", weightLbs: 225, reps: 5 }], "a"),
      strengthWorkout("2026-06-01", [{ exercise: "Squat", weightLbs: 235, reps: 3 }], "b")
    ];
    expect(listTrackedExercises(workouts)).toEqual([]);
  });

  it("ignores sets missing weight or reps and non-strength workouts", () => {
    const workouts = [
      cardioWorkout("2026-06-01"),
      strengthWorkout("2026-06-02", [{ exercise: "Push-Up", reps: 20 }]),
      strengthWorkout("2026-06-05", [{ exercise: "Push-Up", reps: 20 }]),
      strengthWorkout("2026-06-03", [{ exercise: "Plank", durationSeconds: 60 }]),
      strengthWorkout("2026-06-04", [{ exercise: "Plank", durationSeconds: 60 }])
    ];
    expect(listTrackedExercises(workouts)).toEqual([]);
  });

  it("orders exercises by most recent session and merges normalized name variants", () => {
    const workouts = [
      strengthWorkout("2026-06-01", [
        { exercise: "Barbell Back Squat (5 × 5)", weightLbs: 225, reps: 5 },
        { exercise: "Barbell Bench Press", weightLbs: 185, reps: 5 }
      ]),
      strengthWorkout("2026-06-10", [{ exercise: "Barbell Bench Press", weightLbs: 190, reps: 5 }]),
      strengthWorkout("2026-06-15", [{ exercise: "Barbell Back Squat", weightLbs: 235, reps: 5 }])
    ];
    // Squat's latest session (6/15) is newer than bench's (6/10), and the
    // parenthetical scheme variant collapses into one tracked exercise whose
    // display name comes from the most recent session.
    expect(listTrackedExercises(workouts)).toEqual(["Barbell Back Squat", "Barbell Bench Press"]);
  });
});

describe("buildExerciseSeries", () => {
  it("picks the top set per session by e1RM, not raw weight", () => {
    const workouts = [
      strengthWorkout("2026-06-01", [
        { exercise: "Bench Press", weightLbs: 205, reps: 1 }, // e1RM ≈ 211.8
        { exercise: "Bench Press", weightLbs: 185, reps: 8 } // e1RM ≈ 234.3 → wins
      ])
    ];
    const series = buildExerciseSeries(workouts, "Bench Press");
    expect(series).toHaveLength(1);
    expect(series[0].topSetWeightLbs).toBe(185);
    expect(series[0].topSetReps).toBe(8);
    expect(series[0].e1Rm).toBe(Math.round(185 * (1 + 8 / 30)));
  });

  it("sums session volume across counted sets and skips incomplete sets", () => {
    const workouts = [
      strengthWorkout("2026-06-01", [
        { exercise: "Bench Press", weightLbs: 185, reps: 5 },
        { exercise: "Bench Press", weightLbs: 185, reps: 5 },
        { exercise: "Bench Press", weightLbs: 135, reps: 10 },
        { exercise: "Bench Press", reps: 10 }, // no weight → excluded
        { exercise: "Squat", weightLbs: 225, reps: 5 } // other lift → excluded
      ])
    ];
    const series = buildExerciseSeries(workouts, "Bench Press");
    expect(series[0].volumeLbs).toBe(185 * 5 + 185 * 5 + 135 * 10);
  });

  it("returns one point per date in chronological order regardless of input order", () => {
    const workouts = [
      strengthWorkout("2026-06-15", [{ exercise: "Squat", weightLbs: 245, reps: 5 }]),
      strengthWorkout("2026-06-01", [{ exercise: "Squat", weightLbs: 225, reps: 5 }]),
      strengthWorkout("2026-06-08", [{ exercise: "Squat", weightLbs: 235, reps: 5 }])
    ];
    const series = buildExerciseSeries(workouts, "Squat");
    expect(series.map((point) => point.date)).toEqual(["2026-06-01", "2026-06-08", "2026-06-15"]);
  });

  it("merges same-date workouts into a single point", () => {
    const workouts = [
      strengthWorkout("2026-06-01", [{ exercise: "Squat", weightLbs: 225, reps: 5 }], "am"),
      strengthWorkout("2026-06-01", [{ exercise: "Squat", weightLbs: 235, reps: 3 }], "pm")
    ];
    const series = buildExerciseSeries(workouts, "Squat");
    expect(series).toHaveLength(1);
    // 225×5 e1RM 262.5 beats 235×3 e1RM 258.5
    expect(series[0].topSetWeightLbs).toBe(225);
    expect(series[0].volumeLbs).toBe(225 * 5 + 235 * 3);
  });

  it("matches names case-insensitively and past scheme parentheticals", () => {
    const workouts = [
      strengthWorkout("2026-06-01", [
        { exercise: "Flat Dumbbell Bench Press (4 × 8–10)", weightLbs: 50, reps: 8 }
      ])
    ];
    expect(buildExerciseSeries(workouts, "flat dumbbell bench press")).toHaveLength(1);
    expect(buildExerciseSeries(workouts, "")).toEqual([]);
    expect(buildExerciseSeries(workouts, "Deadlift")).toEqual([]);
  });
});

describe("getExerciseSeriesStats", () => {
  function point(date: string, e1Rm: number): ExerciseSeriesPoint {
    return { date, topSetWeightLbs: e1Rm, topSetReps: 1, e1Rm, volumeLbs: e1Rm };
  }

  it("is undefined for an empty series", () => {
    expect(getExerciseSeriesStats([])).toBeUndefined();
  });

  it("reports current, all-time best, and 30-day change vs the last point ≥30 days back", () => {
    const stats = getExerciseSeriesStats([
      point("2026-04-01", 200),
      point("2026-05-20", 230), // ≥30 days before 7/1 → baseline
      point("2026-06-20", 240),
      point("2026-07-01", 226)
    ]);
    expect(stats).toEqual({ currentE1Rm: 226, bestE1Rm: 240, change30dLbs: -4 });
  });

  it("falls back to the first point when everything is within 30 days", () => {
    const stats = getExerciseSeriesStats([point("2026-06-20", 210), point("2026-07-01", 220)]);
    expect(stats).toEqual({ currentE1Rm: 220, bestE1Rm: 220, change30dLbs: 10 });
  });
});
