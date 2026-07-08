import { describe, expect, it } from "vitest";

import {
  bestRecentE1Rm,
  buildProgressionContext,
  buildProgressiveSession,
  classifyExercise,
  epleyE1Rm,
  formatPrescriptionLine,
  getNextPrescription,
  nextKettlebellSizeLbs,
  nextStrengthFocus,
  progressionIncrementLbs,
  summarizeExerciseHistory,
  type ExerciseSession
} from "@/domain/strengthProgression";
import { defaultTrainingProfile, type TrainingProfile } from "@/domain/trainingProfile";
import type { StrengthSet, Workout } from "@/domain/types";

const NOW = "2026-07-01T10:00:00.000Z";

function strengthWorkout(date: string, sets: StrengthSet[], title = "Session"): Workout {
  return {
    id: `w-${date}`,
    date,
    type: "strength",
    source: "manual",
    title,
    sets,
    recordedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW
  };
}

function session(date: string, weightLbs?: number, reps?: number): ExerciseSession {
  return { date, topWeightLbs: weightLbs, topReps: reps, setCount: 5, e1Rm: undefined };
}

describe("epleyE1Rm", () => {
  it("computes w × (1 + reps/30)", () => {
    expect(epleyE1Rm(185, 5)).toBeCloseTo(185 * (1 + 5 / 30), 5);
    expect(epleyE1Rm(100, 10)).toBeCloseTo(133.333, 2);
  });

  it("is zero for non-positive weight and treats missing reps as 1", () => {
    expect(epleyE1Rm(0, 5)).toBe(0);
    expect(epleyE1Rm(-10, 5)).toBe(0);
    expect(epleyE1Rm(100, 0)).toBeCloseTo(100 * (1 + 1 / 30), 5);
  });
});

describe("summarizeExerciseHistory / bestRecentE1Rm", () => {
  const workouts = [
    strengthWorkout("2026-06-20", [
      { exercise: "Flat Dumbbell Bench Press (4 × 8–10)", reps: 8, weightLbs: 50 },
      { exercise: "Dumbbell Curl", reps: 12, weightLbs: 25 }
    ]),
    strengthWorkout("2026-06-27", [
      { exercise: "Dumbbell Bench Press", reps: 8, weightLbs: 55 },
      { exercise: "Dumbbell Bench Press", reps: 6, weightLbs: 60 }
    ])
  ];

  it("matches names despite scheme parentheticals and picks the top set per session", () => {
    const history = summarizeExerciseHistory("Dumbbell Bench Press", workouts);
    expect(history).toHaveLength(2);
    // newest first
    expect(history[0].date).toBe("2026-06-27");
    // 60×6 (e1RM 72) beats 55×8 (e1RM ~69.7)
    expect(history[0].topWeightLbs).toBe(60);
    expect(history[0].topReps).toBe(6);
    expect(history[1].topWeightLbs).toBe(50);
  });

  it("uses the best recent set for e1RM", () => {
    const best = bestRecentE1Rm("Dumbbell Bench Press", workouts);
    expect(best).toBe(Math.round(60 * (1 + 6 / 30)));
  });

  it("returns undefined with no history", () => {
    expect(bestRecentE1Rm("Barbell Back Squat", workouts)).toBeUndefined();
  });
});

describe("classification + increments", () => {
  it("classifies kettlebell, lower-body barbell and isolation moves", () => {
    expect(classifyExercise("Kettlebell Swing")).toBe("kettlebell");
    expect(classifyExercise("Barbell Back Squat")).toBe("barbell_lower");
    expect(classifyExercise("Dumbbell Curl")).toBe("isolation");
    expect(classifyExercise("Barbell Bench Press")).toBe("standard");
  });

  it("uses +10 lower-body barbell, +2.5 isolation, +5 otherwise", () => {
    expect(progressionIncrementLbs("Barbell Back Squat")).toBe(10);
    expect(progressionIncrementLbs("Dumbbell Lateral Raise")).toBe(2.5);
    expect(progressionIncrementLbs("Barbell Bench Press")).toBe(5);
  });
});

describe("getNextPrescription", () => {
  it("adds +5 lb after hitting target reps on an upper-body lift", () => {
    const p = getNextPrescription("Barbell Bench Press", [session("2026-06-28", 185, 5)], {
      sets: 5,
      targetReps: 5
    });
    expect(p).toMatchObject({ exercise: "Barbell Bench Press", sets: 5, reps: 5, weightLbs: 190 });
    expect(p.note).toContain("185");
    expect(p.note).toContain("190");
  });

  it("adds +10 lb on a lower-body barbell lift", () => {
    const p = getNextPrescription("Barbell Back Squat", [session("2026-06-28", 200, 5)], {
      sets: 5,
      targetReps: 5
    });
    expect(p.weightLbs).toBe(210);
  });

  it("treats unrecorded reps as a hit (logged as prescribed)", () => {
    const p = getNextPrescription("Barbell Bench Press", [session("2026-06-28", 185, undefined)], {
      sets: 5,
      targetReps: 5
    });
    expect(p.weightLbs).toBe(190);
  });

  it("repeats the weight after a single miss", () => {
    const p = getNextPrescription("Barbell Bench Press", [session("2026-06-28", 200, 3)], {
      sets: 5,
      targetReps: 5
    });
    expect(p.weightLbs).toBe(200);
    expect(p.note).toMatch(/repeat/i);
  });

  it("deloads 10% after two straight misses at the same weight", () => {
    const p = getNextPrescription(
      "Barbell Bench Press",
      [session("2026-06-28", 200, 3), session("2026-06-25", 200, 4)],
      { sets: 5, targetReps: 5 }
    );
    expect(p.weightLbs).toBe(180);
    expect(p.note).toMatch(/deload/i);
  });

  it("progresses reps (5→8) on a fixed-load kettlebell before sizing up", () => {
    const p = getNextPrescription("Kettlebell Goblet Squat", [session("2026-06-28", 25, 5)], {
      sets: 3,
      targetReps: 5,
      maxReps: 8
    });
    expect(p).toMatchObject({ sets: 3, reps: 6, weightLbs: 25 });
  });

  it("suggests the next bell size once the rep ceiling is owned", () => {
    const p = getNextPrescription("Kettlebell Goblet Squat", [session("2026-06-28", 25, 8)], {
      sets: 3,
      targetReps: 5,
      maxReps: 8
    });
    expect(p.weightLbs).toBe(30);
    expect(p.reps).toBe(5);
    expect(p.note).toMatch(/next bell/i);
  });

  it("gives a start-light note with no history", () => {
    const p = getNextPrescription("Barbell Overhead Press", [], { sets: 5, targetReps: 5 });
    expect(p.weightLbs).toBeUndefined();
    expect(p.note).toMatch(/start light/i);
  });
});

describe("nextKettlebellSizeLbs", () => {
  it("steps up through common bell sizes", () => {
    expect(nextKettlebellSizeLbs(25)).toBe(30);
    expect(nextKettlebellSizeLbs(53)).toBe(62);
  });

  it("adds 10 lb beyond the table", () => {
    expect(nextKettlebellSizeLbs(70)).toBe(80);
  });
});

describe("nextStrengthFocus", () => {
  it("defaults to squat with no history and rotates past the last main lift", () => {
    expect(nextStrengthFocus([])).toBe("squat");
    const squatDay = strengthWorkout(
      "2026-06-28",
      [{ exercise: "Barbell Back Squat", reps: 5, weightLbs: 200 }],
      "Squat day — simple progression"
    );
    expect(nextStrengthFocus([squatDay])).toBe("bench");
    const rowDay = strengthWorkout(
      "2026-06-29",
      [{ exercise: "Barbell Row", reps: 5, weightLbs: 135 }],
      "Row day"
    );
    expect(nextStrengthFocus([squatDay, rowDay])).toBe("squat"); // row wraps around
  });
});

describe("buildProgressiveSession", () => {
  const gymProfile = defaultTrainingProfile(NOW);

  it("programs barbell mains with a kettlebell finisher for the gym profile", () => {
    const session = buildProgressiveSession(gymProfile, [], "squat");
    expect(session.title).toMatch(/Squat day/);
    expect(session.prescriptions.length).toBeGreaterThanOrEqual(3);
    expect(session.prescriptions.length).toBeLessThanOrEqual(4);
    expect(session.prescriptions[0]).toMatchObject({
      exercise: "Barbell Back Squat",
      sets: 5,
      reps: 5
    });
    expect(session.prescriptions.at(-1)?.exercise).toBe("Kettlebell Swing");
  });

  it("stays equipment-aware without a barbell or gym", () => {
    const homeProfile: TrainingProfile = {
      ...gymProfile,
      gymAccess: false,
      equipment: { ...gymProfile.equipment, barbell: false, machines: false }
    };
    const session = buildProgressiveSession(homeProfile, [], "squat");
    expect(session.prescriptions[0].exercise).toBe("Kettlebell Goblet Squat");
    expect(
      session.prescriptions.every((p) => !/barbell|machine|leg press|lat pulldown/i.test(p.exercise))
    ).toBe(true);
  });

  it("skips the kettlebell finisher when there is no bell", () => {
    const noBell: TrainingProfile = {
      ...gymProfile,
      equipment: { ...gymProfile.equipment, kettlebells: false }
    };
    const session = buildProgressiveSession(noBell, [], "bench");
    expect(session.prescriptions.some((p) => /kettlebell swing/i.test(p.exercise))).toBe(false);
  });

  it("carries progression numbers from the log into the main lift", () => {
    const history = [
      strengthWorkout("2026-06-27", [{ exercise: "Barbell Bench Press", reps: 5, weightLbs: 185 }])
    ];
    const session = buildProgressiveSession(gymProfile, history, "bench");
    expect(session.prescriptions[0].weightLbs).toBe(190);
    expect(session.summary).toContain("190");
  });
});

describe("prompt context", () => {
  it("includes last-session numbers, e1RM and the engine's call", () => {
    const profile = defaultTrainingProfile(NOW);
    const history = [
      strengthWorkout("2026-06-27", [{ exercise: "Barbell Back Squat", reps: 5, weightLbs: 200 }])
    ];
    // last focus squat → next focus bench
    const context = buildProgressionContext(profile, history);
    expect(context).toContain("Next focus in the rotation: Bench");
    expect(context).toMatch(/Barbell Bench Press/);
  });

  it("formats prescription display lines", () => {
    expect(
      formatPrescriptionLine({ exercise: "Goblet Squat", sets: 3, reps: 8, weightLbs: 50 })
    ).toBe("Goblet Squat — 3×8 @ 50 lb");
    expect(formatPrescriptionLine({ exercise: "Push-Up", sets: 3, reps: 12 })).toBe(
      "Push-Up — 3×12"
    );
  });
});
