import { describe, expect, it } from "vitest";

import {
  computePersonalRecords,
  detectNewRecords,
  displayExerciseName,
  formatRecordTitle,
  prSetIndexesForWorkout
} from "@/domain/personalRecords";
import { createWorkout, type StrengthSetInput } from "@/domain/workouts";
import type { Workout } from "@/domain";

function strengthWorkout(
  date: string,
  sets: StrengthSetInput[],
  recordedAt = `${date}T10:00:00.000Z`
): Workout {
  return createWorkout({ date, type: "strength", sets }, recordedAt);
}

describe("displayExerciseName", () => {
  it("strips the parenthetical scheme and squeezes whitespace", () => {
    expect(displayExerciseName("Incline Dumbbell Press (4 × 8–10)")).toBe(
      "Incline Dumbbell Press"
    );
    expect(displayExerciseName("Goblet Squat")).toBe("Goblet Squat");
  });
});

describe("computePersonalRecords", () => {
  it("aggregates best weight, best e1RM, and best reps per weight", () => {
    const history = [
      strengthWorkout("2026-07-01", [
        { exercise: "Incline Bench", weightLbs: 185, reps: 8 },
        { exercise: "Incline Bench", weightLbs: 200, reps: 5 }
      ]),
      strengthWorkout("2026-07-03", [{ exercise: "Incline Bench (4 × 8)", weightLbs: 185, reps: 6 }])
    ];
    const records = computePersonalRecords(history);
    const bench = records.get("incline bench");
    expect(bench).toBeDefined();
    expect(bench!.bestWeightLbs).toBe(200);
    // e1RM: 200 × (1 + 5/30) ≈ 233.3 beats 185 × (1 + 8/30) ≈ 234.3 → 234.3 wins
    expect(Math.round(bench!.bestE1Rm)).toBe(234);
    // Reps at 185 keep the best (8), the later 6-rep session doesn't regress it.
    expect(bench!.bestRepsAtWeight.get(185)).toBe(8);
    expect(bench!.bestRepsAtWeight.get(200)).toBe(5);
  });

  it("ignores bodyweight sets and non-strength workouts", () => {
    const workouts = [
      strengthWorkout("2026-07-01", [{ exercise: "Push-Up", reps: 20 }]),
      createWorkout({ date: "2026-07-01", type: "cardio", title: "Run" }, "2026-07-01T09:00:00.000Z")
    ];
    expect(computePersonalRecords(workouts).size).toBe(0);
  });
});

describe("detectNewRecords", () => {
  it("treats the first-ever session of an exercise as baseline — no PR spam", () => {
    const first = strengthWorkout("2026-07-01", [
      { exercise: "Incline Bench", weightLbs: 185, reps: 8 }
    ]);
    expect(detectNewRecords([], first)).toEqual([]);
  });

  it("stays silent for a brand-new exercise even when other lifts have history", () => {
    const history = [
      strengthWorkout("2026-07-01", [{ exercise: "Back Squat", weightLbs: 225, reps: 5 }])
    ];
    const workout = strengthWorkout("2026-07-05", [
      { exercise: "Incline Bench", weightLbs: 185, reps: 8 }
    ]);
    expect(detectNewRecords(history, workout)).toEqual([]);
  });

  it("detects a weight PR", () => {
    const history = [
      strengthWorkout("2026-07-01", [{ exercise: "Incline Bench", weightLbs: 200, reps: 5 }])
    ];
    const workout = strengthWorkout("2026-07-05", [
      { exercise: "Incline Bench", weightLbs: 205, reps: 3 }
    ]);
    const records = detectNewRecords(history, workout);
    expect(records.map((r) => r.kind)).toEqual(["weight"]);
    expect(records[0].value).toBe(205);
    expect(records[0].previousValue).toBe(200);
    expect(records[0].summary).toBe("New weight PR: Incline Bench 205 lb (was 200)");
    // 205 × 3 → e1RM ≈ 225.5, below the prior ≈ 233.3 — no e1RM record.
  });

  it("detects an e1RM PR without a weight PR", () => {
    const history = [
      strengthWorkout("2026-07-01", [{ exercise: "Incline Bench", weightLbs: 200, reps: 5 }])
    ];
    // 195 × 8 → e1RM = 247 beats 200 × 5 → ≈ 233.3, but 195 < 200 lb.
    const workout = strengthWorkout("2026-07-05", [
      { exercise: "Incline Bench", weightLbs: 195, reps: 8 }
    ]);
    const records = detectNewRecords(history, workout);
    expect(records.map((r) => r.kind)).toEqual(["e1rm"]);
    expect(records[0].summary).toBe("New e1RM: Incline Bench 247 lb (was 233)");
  });

  it("detects a reps-at-weight PR without weight or e1RM records", () => {
    const history = [
      strengthWorkout("2026-07-01", [
        { exercise: "Incline Bench", weightLbs: 185, reps: 8 },
        { exercise: "Incline Bench", weightLbs: 250, reps: 1 }
      ])
    ];
    // 185 × 10 → e1RM ≈ 246.7, still below the 250 single (≈ 258.3).
    const workout = strengthWorkout("2026-07-05", [
      { exercise: "Incline Bench", weightLbs: 185, reps: 10 }
    ]);
    const records = detectNewRecords(history, workout);
    expect(records.map((r) => r.kind)).toEqual(["reps"]);
    expect(records[0].weightLbs).toBe(185);
    expect(records[0].summary).toBe("New reps PR: Incline Bench 10 × 185 lb (was 8)");
  });

  it("keeps only the best set per exercise and kind", () => {
    const history = [
      strengthWorkout("2026-07-01", [{ exercise: "Incline Bench", weightLbs: 200, reps: 5 }])
    ];
    const workout = strengthWorkout("2026-07-05", [
      { exercise: "Incline Bench", weightLbs: 205, reps: 1 },
      { exercise: "Incline Bench", weightLbs: 210, reps: 1 }
    ]);
    const weightRecords = detectNewRecords(history, workout).filter((r) => r.kind === "weight");
    expect(weightRecords).toHaveLength(1);
    expect(weightRecords[0].value).toBe(210);
    expect(weightRecords[0].setIndex).toBe(1);
  });

  it("matches exercises across scheme suffixes via normalization", () => {
    const history = [
      strengthWorkout("2026-07-01", [{ exercise: "Incline Bench (4 × 8–10)", weightLbs: 200, reps: 5 }])
    ];
    const workout = strengthWorkout("2026-07-05", [
      { exercise: "Incline Bench", weightLbs: 205, reps: 5 }
    ]);
    const kinds = detectNewRecords(history, workout).map((r) => r.kind);
    expect(kinds).toContain("weight");
  });

  it("returns nothing for non-strength workouts", () => {
    const workout = createWorkout(
      { date: "2026-07-05", type: "cardio", title: "Run" },
      "2026-07-05T10:00:00.000Z"
    );
    expect(detectNewRecords([], workout)).toEqual([]);
  });
});

describe("formatRecordTitle", () => {
  it("formats weight and e1RM records as an all-caps banner", () => {
    const history = [
      strengthWorkout("2026-07-01", [{ exercise: "Incline Bench", weightLbs: 200, reps: 5 }])
    ];
    const workout = strengthWorkout("2026-07-05", [
      { exercise: "Incline Bench", weightLbs: 205, reps: 3 }
    ]);
    const [record] = detectNewRecords(history, workout);
    expect(formatRecordTitle(record)).toBe("NEW RECORD — INCLINE BENCH 205 LB");
  });

  it("formats reps records with the rep × weight shape", () => {
    const history = [
      strengthWorkout("2026-07-01", [
        { exercise: "Incline Bench", weightLbs: 185, reps: 8 },
        { exercise: "Incline Bench", weightLbs: 250, reps: 1 }
      ])
    ];
    const workout = strengthWorkout("2026-07-05", [
      { exercise: "Incline Bench", weightLbs: 185, reps: 10 }
    ]);
    const [record] = detectNewRecords(history, workout);
    expect(formatRecordTitle(record)).toBe("NEW RECORD — INCLINE BENCH 10 × 185 LB");
  });
});

describe("prSetIndexesForWorkout", () => {
  it("flags only the record-setting rows, judged against earlier history", () => {
    const older = strengthWorkout("2026-07-01", [
      { exercise: "Incline Bench", weightLbs: 200, reps: 5 }
    ]);
    const logged = strengthWorkout("2026-07-05", [
      { exercise: "Incline Bench", weightLbs: 195, reps: 3 },
      { exercise: "Incline Bench", weightLbs: 205, reps: 3 }
    ]);
    const indexes = prSetIndexesForWorkout([logged, older], logged);
    expect([...indexes]).toEqual([1]);
  });

  it("does not judge a workout against sessions recorded after it", () => {
    const first = strengthWorkout("2026-07-01", [
      { exercise: "Incline Bench", weightLbs: 200, reps: 5 }
    ]);
    const later = strengthWorkout("2026-07-05", [
      { exercise: "Incline Bench", weightLbs: 225, reps: 5 }
    ]);
    // "first" was the baseline session — no badge, even with a heavier later log present.
    expect(prSetIndexesForWorkout([later, first], first).size).toBe(0);
    // "later" beat the baseline.
    expect([...prSetIndexesForWorkout([later, first], later)]).toEqual([0]);
  });
});
