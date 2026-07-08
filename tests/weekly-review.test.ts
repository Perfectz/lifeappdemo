import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/ai/weekly-review/route";
import {
  buildLocalWeeklyReview,
  buildWeeklyReviewSignature,
  clearWeeklyReviewCache,
  currentWeekStart,
  getOrComputeWeeklyReview
} from "@/client/weeklyReview";
import { upsertDailyTarget } from "@/data/dailyNutritionTargetRepository";
import { createLocalFoodEntryRepository } from "@/data/foodEntryRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalWorkoutRepository } from "@/data/workoutRepository";
import type { DailyNutritionTarget } from "@/domain/dailyNutritionTarget";
import type { FoodEntry, IsoDate, MetricEntry, Task, Workout, WorkoutType } from "@/domain";
import {
  addDaysIso,
  buildDeterministicWeeklyNarrative,
  buildWeeklyReview,
  clampWeeklyReviewFromAI,
  isWeeklyReview,
  isWeeklyReviewNarrative,
  weekStartOf,
  type WeeklyReviewInput,
  type WeeklyReviewNarrative
} from "@/domain/weeklyReview";
import { setWeeklyReviewForTests } from "@/server/ai/weeklyReviewClient";
import { AINotConfiguredError } from "@/server/ai/openaiClient";
import { resetRateLimiter } from "@/server/ai/rateLimiter";

// 2026-06-29 is a Monday; the week runs through Sunday 2026-07-05.
const WEEK_START: IsoDate = "2026-06-29";
const WEEK_END: IsoDate = "2026-07-05";
const NOW = "2026-07-06T09:00:00.000Z";

let seq = 0;

function stamp(date: IsoDate, hour = 12): string {
  return `${date}T${String(hour).padStart(2, "0")}:00:00.000Z`;
}

function mkWorkout(date: IsoDate, type: WorkoutType, extra: Partial<Workout> = {}): Workout {
  seq += 1;
  return {
    id: `workout-${seq}`,
    date,
    type,
    source: "manual",
    recordedAt: stamp(date, 10),
    createdAt: stamp(date, 10),
    updatedAt: stamp(date, 10),
    ...extra
  };
}

function mkStrength(
  date: IsoDate,
  sets: { exercise: string; reps?: number; weightLbs?: number }[],
  extra: Partial<Workout> = {}
): Workout {
  return mkWorkout(date, "strength", { sets, ...extra });
}

function mkMetric(date: IsoDate, fields: Partial<MetricEntry> = {}): MetricEntry {
  seq += 1;
  return {
    id: `metric-${seq}`,
    date,
    checkInType: "morning",
    source: "manual",
    recordedAt: stamp(date, 8),
    createdAt: stamp(date, 8),
    updatedAt: stamp(date, 8),
    ...fields
  };
}

function mkFood(date: IsoDate, calories: number, proteinG = 0): FoodEntry {
  seq += 1;
  return {
    id: `food-${seq}`,
    date,
    mealType: "lunch",
    description: "test food",
    macros: { calories, proteinG },
    estimateSource: "manual",
    recordedAt: stamp(date, 13),
    createdAt: stamp(date, 13),
    updatedAt: stamp(date, 13)
  };
}

function mkTarget(date: IsoDate, calorieTarget = 2000, proteinTargetG = 160): DailyNutritionTarget {
  return {
    date,
    calorieTarget,
    proteinTargetG,
    carbsTargetG: 180,
    fatTargetG: 56,
    rationale: "test",
    source: "computed",
    createdAt: stamp(date, 6)
  };
}

function mkTask(fields: Partial<Task> = {}): Task {
  seq += 1;
  return {
    id: `task-${seq}`,
    title: "test quest",
    status: "todo",
    priority: "medium",
    tags: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...fields
  };
}

function build(overrides: Partial<WeeklyReviewInput> = {}) {
  return buildWeeklyReview({
    weekStart: WEEK_START,
    workouts: [],
    metrics: [],
    foodEntries: [],
    targets: [],
    tasks: [],
    ...overrides
  });
}

describe("week math", () => {
  it("snaps any day back to its Monday and ends on Sunday", () => {
    expect(weekStartOf("2026-07-01")).toBe(WEEK_START); // Wednesday
    expect(weekStartOf("2026-07-05")).toBe(WEEK_START); // Sunday
    expect(weekStartOf(WEEK_START)).toBe(WEEK_START); // Monday is stable
    const review = build({ weekStart: "2026-07-01" });
    expect(review.range).toEqual({ start: WEEK_START, end: WEEK_END });
  });

  it("addDaysIso steps across month boundaries", () => {
    expect(addDaysIso("2026-06-29", 6)).toBe("2026-07-05");
    expect(addDaysIso("2026-07-06", -7)).toBe("2026-06-29");
  });
});

describe("buildWeeklyReview — training", () => {
  it("uses elapsed days for the session target, capped at 21", () => {
    // Past week (today after the range) → all 7 days count.
    expect(build({ today: "2026-07-20" }).training.targetSessions).toBe(21);
    expect(build().training.targetSessions).toBe(21);
    // Mid-week Tuesday → 2 days elapsed × 3.
    expect(build({ today: "2026-06-30" }).training.targetSessions).toBe(6);
    // On the Monday itself → one day.
    expect(build({ today: WEEK_START }).training.targetSessions).toBe(3);
  });

  it("counts sessions by type inside the range only", () => {
    const review = build({
      workouts: [
        mkStrength(WEEK_START, [{ exercise: "Bench", reps: 5, weightLbs: 100 }]),
        mkStrength("2026-07-01", [{ exercise: "Bench", reps: 5, weightLbs: 100 }]),
        mkWorkout("2026-07-02", "cardio"),
        mkWorkout(WEEK_END, "martial_arts"),
        mkWorkout("2026-06-28", "cardio"), // Sunday before — out
        mkWorkout("2026-07-06", "strength") // Monday after — out
      ]
    });
    expect(review.training.sessionsByType).toEqual({ strength: 2, cardio: 1, martial_arts: 1 });
    expect(review.training.totalSessions).toBe(4);
  });

  it("ranks best lifts by e1RM, one per exercise, top 3", () => {
    const review = build({
      workouts: [
        mkStrength("2026-06-30", [
          { exercise: "Bench Press", reps: 5, weightLbs: 200 }, // e1RM ≈ 233
          { exercise: "Bench Press", reps: 3, weightLbs: 205 }, // e1RM ≈ 226 (worse)
          { exercise: "Squat", reps: 3, weightLbs: 250 }, // e1RM ≈ 275
          { exercise: "Overhead Press", reps: 8, weightLbs: 100 }, // e1RM ≈ 127
          { exercise: "Row", reps: 1, weightLbs: 150 } // e1RM = 150
        ])
      ]
    });
    expect(review.training.bestLifts.map((lift) => lift.exercise)).toEqual([
      "Squat",
      "Bench Press",
      "Row"
    ]);
    expect(review.training.bestLifts[0]).toEqual({
      exercise: "Squat",
      e1Rm: 275,
      weightLbs: 250,
      reps: 3
    });
  });

  it("detects PRs against pre-week history only — baselines never celebrate", () => {
    const review = build({
      workouts: [
        // Pre-week history: bench best 185×5.
        mkStrength("2026-06-20", [{ exercise: "Bench Press", reps: 5, weightLbs: 185 }]),
        // In-week: beats the pre-week bench, first-ever deadlift.
        mkStrength("2026-06-30", [
          { exercise: "Bench Press", reps: 5, weightLbs: 190 },
          { exercise: "Deadlift", reps: 5, weightLbs: 300 }
        ])
      ]
    });
    expect(review.training.newPRs.some((pr) => pr.includes("Bench Press") && pr.includes("190"))).toBe(
      true
    );
    // First time an exercise carries weight → baseline, not a PR.
    expect(review.training.newPRs.some((pr) => pr.includes("Deadlift"))).toBe(false);
  });

  it("keeps only the best PR per exercise/kind when the week beats itself twice", () => {
    const review = build({
      workouts: [
        mkStrength("2026-06-20", [{ exercise: "Bench Press", reps: 5, weightLbs: 185 }]),
        mkStrength("2026-06-29", [{ exercise: "Bench Press", reps: 5, weightLbs: 190 }]),
        mkStrength("2026-07-02", [{ exercise: "Bench Press", reps: 5, weightLbs: 195 }])
      ]
    });
    const weightPRs = review.training.newPRs.filter((pr) => pr.startsWith("New weight PR"));
    expect(weightPRs).toHaveLength(1);
    expect(weightPRs[0]).toContain("195");
  });

  it("a lift is not a PR against sessions logged after it", () => {
    const review = build({
      workouts: [
        // Wednesday 200 comes chronologically AFTER Monday 190 — Monday's 190
        // is judged against the pre-week 185 only.
        mkStrength("2026-06-20", [{ exercise: "Squat", reps: 5, weightLbs: 185 }]),
        mkStrength("2026-07-01", [{ exercise: "Squat", reps: 5, weightLbs: 200 }]),
        mkStrength("2026-06-29", [{ exercise: "Squat", reps: 5, weightLbs: 190 }])
      ]
    });
    const weightPRs = review.training.newPRs.filter((pr) => pr.startsWith("New weight PR"));
    expect(weightPRs).toHaveLength(1);
    expect(weightPRs[0]).toContain("200");
  });

  it("totals kettlebell swings from metrics, falling back to logged sets", () => {
    const fromMetrics = build({
      metrics: [
        mkMetric("2026-06-30", { kettlebellSwingsTotal: 100 }),
        mkMetric("2026-07-02", { kettlebellSwingsTotal: 150 }),
        mkMetric("2026-06-28", { kettlebellSwingsTotal: 999 }) // out of range
      ]
    });
    expect(fromMetrics.training.kettlebellSwings).toBe(250);

    const fromSets = build({
      workouts: [
        mkStrength("2026-06-30", [
          { exercise: "Kettlebell Swing", reps: 25, weightLbs: 53 },
          { exercise: "Kettlebell Swing", reps: 25, weightLbs: 53 }
        ])
      ]
    });
    expect(fromSets.training.kettlebellSwings).toBe(50);
  });

  it("counts karate classes as distinct dates", () => {
    const review = build({
      metrics: [
        mkMetric("2026-06-30", { karateClass: true }),
        mkMetric("2026-06-30", { karateClass: true }), // same day, two check-ins
        mkMetric("2026-07-03", { karateClass: true }),
        mkMetric("2026-07-04", { karateClass: false })
      ]
    });
    expect(review.training.karateClasses).toBe(2);
  });
});

describe("buildWeeklyReview — nutrition", () => {
  it("averages per logged day and computes ±10% adherence only where a target existed", () => {
    const review = build({
      foodEntries: [
        // Day 1: 2000 kcal vs 2000 target → within ±10%.
        mkFood("2026-06-29", 1200, 80),
        mkFood("2026-06-29", 800, 40),
        // Day 2: 2300 kcal vs 2000 target → outside ±10% (band is 200).
        mkFood("2026-06-30", 2300, 90),
        // Day 3: logged but no target that day → excluded from adherence.
        mkFood("2026-07-01", 1700, 130)
      ],
      targets: [mkTarget("2026-06-29", 2000), mkTarget("2026-06-30", 2000)]
    });
    expect(review.nutrition.daysLogged).toBe(3);
    expect(review.nutrition.avgCalories).toBe(2000); // (2000+2300+1700)/3
    expect(review.nutrition.avgProtein).toBe(113); // (120+90+130)/3 = 113.3
    expect(review.nutrition.adherencePct).toBe(50); // 1 of 2 target days
  });

  it("treats the exact ±10% edge as adherent", () => {
    const review = build({
      foodEntries: [mkFood("2026-06-29", 2200)],
      targets: [mkTarget("2026-06-29", 2000)]
    });
    expect(review.nutrition.adherencePct).toBe(100);
  });

  it("returns nulls when nothing is logged and omits the water note without data", () => {
    const review = build();
    expect(review.nutrition.daysLogged).toBe(0);
    expect(review.nutrition.avgCalories).toBeNull();
    expect(review.nutrition.avgProtein).toBeNull();
    expect(review.nutrition.adherencePct).toBeNull();
    expect("waterNote" in review.nutrition).toBe(false);
  });

  it("includes a water note only when in-range water data exists", () => {
    const review = build({
      foodEntries: [mkFood("2026-06-29", 1800)],
      waterByDate: { "2026-06-29": 64, "2026-07-01": 48, "2026-06-28": 64 }
    });
    expect(review.nutrition.waterNote).toContain("2 of 7");
  });
});

describe("buildWeeklyReview — body & quests", () => {
  it("takes weight from the in-range entries nearest each bound (boundaries inclusive)", () => {
    const review = build({
      metrics: [
        mkMetric("2026-06-28", { weightLbs: 210 }), // Sunday before — excluded
        mkMetric(WEEK_START, { weightLbs: 200 }), // Monday — included
        mkMetric("2026-07-02", { weightLbs: 199 }),
        mkMetric(WEEK_END, { weightLbs: 198 }), // Sunday — included
        mkMetric("2026-07-06", { weightLbs: 190 }) // Monday after — excluded
      ]
    });
    expect(review.body.weightStartLbs).toBe(200);
    expect(review.body.weightEndLbs).toBe(198);
    expect(review.body.weightDeltaLbs).toBe(-2);
  });

  it("reports no delta with a single weigh-in", () => {
    const review = build({ metrics: [mkMetric("2026-07-01", { weightLbs: 201.5 })] });
    expect(review.body.weightStartLbs).toBe(201.5);
    expect(review.body.weightEndLbs).toBe(201.5);
    expect(review.body.weightDeltaLbs).toBeNull();
  });

  it("averages sleep and energy to one decimal", () => {
    const review = build({
      metrics: [
        mkMetric("2026-06-29", { sleepHours: 6, energyLevel: 3 }),
        mkMetric("2026-06-30", { sleepHours: 7.5, energyLevel: 4 })
      ]
    });
    expect(review.body.avgSleepHours).toBe(6.8);
    expect(review.body.avgEnergy).toBe(3.5);
  });

  it("counts quests planned for the week and completed inside it", () => {
    const review = build({
      tasks: [
        mkTask({ plannedForDate: "2026-06-30" }),
        mkTask({ plannedForDate: "2026-07-04", status: "done", completedAt: stamp("2026-07-01", 15) }),
        mkTask({ status: "done", completedAt: stamp("2026-07-02", 15) }), // unplanned but done
        mkTask({ plannedForDate: "2026-07-07" }), // next week
        mkTask({ status: "done", completedAt: stamp("2026-06-24", 15) }) // done before the week
      ]
    });
    expect(review.quests.planned).toBe(2);
    expect(review.quests.completed).toBe(2);
  });
});

describe("buildWeeklyReview — empty week, highlights, focus", () => {
  it("flags a week with no data at all", () => {
    const review = build();
    expect(review.emptyWeek).toBe(true);
    expect(review.highlights).toEqual([]);
    expect(review.focusSuggestions).toEqual([]);
  });

  it("is not empty when any quest or metric exists", () => {
    expect(build({ tasks: [mkTask({ plannedForDate: "2026-07-01" })] }).emptyWeek).toBe(false);
    expect(build({ metrics: [mkMetric("2026-07-01", { sleepHours: 7 })] }).emptyWeek).toBe(false);
  });

  it("puts PRs first in the highlights, then milestones", () => {
    const review = build({
      workouts: [
        mkStrength("2026-06-20", [{ exercise: "Bench Press", reps: 5, weightLbs: 185 }]),
        mkStrength("2026-06-29", [{ exercise: "Bench Press", reps: 5, weightLbs: 195 }])
      ],
      metrics: [
        mkMetric(WEEK_START, { weightLbs: 200 }),
        mkMetric(WEEK_END, { weightLbs: 198 })
      ],
      foodEntries: [
        mkFood("2026-06-29", 2000),
        mkFood("2026-06-30", 1950),
        mkFood("2026-07-01", 2050),
        mkFood("2026-07-02", 1990),
        mkFood("2026-07-03", 2010)
      ],
      targets: ["2026-06-29", "2026-06-30", "2026-07-01", "2026-07-02", "2026-07-03"].map((d) =>
        mkTarget(d, 2000)
      )
    });
    expect(review.highlights[0]).toMatch(/PR|e1RM/);
    expect(review.highlights.some((h) => h.includes("5 of 7 days"))).toBe(true);
    expect(review.highlights.some((h) => h.includes("adherence 100%") || h.includes("100%"))).toBe(true);
    expect(review.highlights.some((h) => h.includes("down 2 lb"))).toBe(true);
    expect(review.highlights.length).toBeLessThanOrEqual(5);
  });

  it("suggests restarting when no training was logged", () => {
    const review = build({ foodEntries: [mkFood("2026-06-29", 1800)] });
    expect(review.focusSuggestions.some((f) => /no training logged/i.test(f))).toBe(true);
  });

  it("targets the lowest-count training type", () => {
    const review = build({
      workouts: [
        mkWorkout("2026-06-29", "strength"),
        mkWorkout("2026-06-30", "strength"),
        mkWorkout("2026-07-01", "cardio")
      ]
    });
    expect(review.focusSuggestions.some((f) => /no martial arts/i.test(f))).toBe(true);
  });

  it("flags protein shortfalls against the logged days' targets", () => {
    const review = build({
      foodEntries: [mkFood("2026-06-29", 2000, 100)], // 100g vs 160g target → < 90%
      targets: [mkTarget("2026-06-29", 2000, 160)]
    });
    expect(review.focusSuggestions.some((f) => f.includes("Protein averaged 100g"))).toBe(true);
  });

  it("flags short sleep and vitals gaps", () => {
    const review = build({
      metrics: [mkMetric("2026-06-29", { sleepHours: 5.5 })]
    });
    expect(review.focusSuggestions.some((f) => f.includes("Sleep averaged 5.5h"))).toBe(true);
    expect(review.focusSuggestions.some((f) => /blood-pressure/i.test(f))).toBe(true);
    expect(review.focusSuggestions.some((f) => /weigh-in/i.test(f))).toBe(true);
  });

  it("skips the vitals-gap nags when BP and weight were logged", () => {
    const review = build({
      metrics: [
        mkMetric("2026-06-29", {
          weightLbs: 200,
          bloodPressureSystolic: 120,
          bloodPressureDiastolic: 80
        })
      ]
    });
    expect(review.focusSuggestions.some((f) => /blood-pressure|weigh-in/i.test(f))).toBe(false);
  });

  it("caps focus suggestions at 4", () => {
    const review = build({
      foodEntries: [mkFood("2026-06-29", 2000, 50)],
      targets: [mkTarget("2026-06-29", 2000, 160)],
      metrics: [mkMetric("2026-06-29", { sleepHours: 5 })]
    });
    expect(review.focusSuggestions.length).toBeLessThanOrEqual(4);
  });
});

describe("deterministic narrative + AI clamp", () => {
  const review = build({
    workouts: [
      mkStrength("2026-06-20", [{ exercise: "Bench Press", reps: 5, weightLbs: 185 }]),
      mkStrength("2026-06-29", [{ exercise: "Bench Press", reps: 5, weightLbs: 195 }]),
      mkWorkout("2026-07-01", "cardio")
    ],
    metrics: [
      mkMetric(WEEK_START, { weightLbs: 200, sleepHours: 6 }),
      mkMetric(WEEK_END, { weightLbs: 198, sleepHours: 7 })
    ],
    foodEntries: [mkFood("2026-06-29", 2000, 150)],
    targets: [mkTarget("2026-06-29", 2000, 160)],
    tasks: [mkTask({ plannedForDate: "2026-07-01", status: "done", completedAt: stamp("2026-07-01", 15) })]
  });
  const deterministic = buildDeterministicWeeklyNarrative(review, NOW);

  it("builds a valid deterministic narrative from the review", () => {
    expect(isWeeklyReviewNarrative(deterministic)).toBe(true);
    expect(deterministic.weekStart).toBe(WEEK_START);
    expect(deterministic.narrative).toContain("trained 2 times");
    expect(deterministic.wins).toEqual(review.highlights.slice(0, 3));
    expect(deterministic.focus).toEqual(review.focusSuggestions.slice(0, 3));
    expect(deterministic.source).toBe("deterministic");
  });

  it("narrates the empty week without inventing stats", () => {
    const empty = buildDeterministicWeeklyNarrative(build(), NOW);
    expect(empty.narrative).toMatch(/nothing logged/i);
    expect(empty.wins).toEqual([]);
    expect(empty.focus).toEqual([]);
  });

  it("clamps AI wins/focus to index-wise rephrasings of the deterministic items", () => {
    const clamped = clampWeeklyReviewFromAI(
      {
        narrative: "Strong week — you showed up three times and set a bench PR.",
        wins: ["Bench PR at 195 — the bar keeps moving.", "", null, "invented", "spam"],
        focus: [null]
      },
      deterministic,
      NOW
    );
    expect(clamped.source).toBe("ai");
    expect(clamped.narrative).toContain("Strong week");
    expect(clamped.wins).toHaveLength(deterministic.wins.length);
    expect(clamped.wins[0]).toContain("the bar keeps moving");
    // Empty/missing rewrites fall back verbatim; items beyond the
    // deterministic count ("invented", "spam") are dropped entirely.
    expect(clamped.wins.slice(1)).toEqual(deterministic.wins.slice(1));
    expect(clamped.focus).toEqual(deterministic.focus);
    expect(isWeeklyReviewNarrative(clamped)).toBe(true);
  });

  it("is tolerant of garbage and caps runaway text", () => {
    const garbage = clampWeeklyReviewFromAI(null, deterministic, NOW);
    expect(garbage.narrative).toBe(deterministic.narrative);
    expect(garbage.wins).toEqual(deterministic.wins);
    expect(garbage.focus).toEqual(deterministic.focus);

    const runaway = clampWeeklyReviewFromAI({ narrative: "x".repeat(5000) }, deterministic, NOW);
    expect(runaway.narrative.length).toBeLessThanOrEqual(900);
  });

  it("validates reviews structurally", () => {
    expect(isWeeklyReview(review)).toBe(true);
    expect(isWeeklyReview(build())).toBe(true);
    expect(isWeeklyReview(null)).toBe(false);
    expect(isWeeklyReview({ ...review, training: undefined })).toBe(false);
  });
});

describe("/api/ai/weekly-review", () => {
  afterEach(() => {
    resetRateLimiter();
    setWeeklyReviewForTests(undefined);
  });

  const review = build({ workouts: [mkWorkout("2026-07-01", "cardio")] });
  const deterministic = buildDeterministicWeeklyNarrative(review, NOW);

  function req(body: unknown): Request {
    return new Request("http://localhost/api/ai/weekly-review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  it("rejects a missing or malformed weekStart", async () => {
    expect((await POST(req({ review, deterministic }))).status).toBe(400);
    expect((await POST(req({ weekStart: "junk", review, deterministic }))).status).toBe(400);
  });

  it("rejects an invalid review or deterministic narrative", async () => {
    expect((await POST(req({ weekStart: WEEK_START, deterministic }))).status).toBe(400);
    expect(
      (await POST(req({ weekStart: WEEK_START, review, deterministic: { narrative: 42 } }))).status
    ).toBe(400);
  });

  it("returns the rewritten narrative on success", async () => {
    setWeeklyReviewForTests(async (input) => ({
      ...input.deterministic,
      narrative: "Coach story of the week.",
      source: "ai"
    }));
    const res = await POST(req({ weekStart: WEEK_START, review, deterministic }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.narrative).toBe("Coach story of the week.");
    expect(data.source).toBe("ai");
  });

  it("maps AINotConfiguredError to 503", async () => {
    setWeeklyReviewForTests(async () => {
      throw new AINotConfiguredError();
    });
    const res = await POST(req({ weekStart: WEEK_START, review, deterministic }));
    expect(res.status).toBe(503);
  });
});

describe("getOrComputeWeeklyReview (client)", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  function seedThisWeekWorkout(): void {
    const repo = createLocalWorkoutRepository(window.localStorage);
    repo.save([...repo.load(), mkWorkout(currentWeekStart(), "cardio")]);
  }

  it("never calls the API for an empty week", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { review, narrative } = await getOrComputeWeeklyReview(
      currentWeekStart(),
      window.localStorage
    );
    expect(review.emptyWeek).toBe(true);
    expect(narrative.source).toBe("deterministic");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to deterministic when the AI fails, then caches by signature", async () => {
    seedThisWeekWorkout();
    const fetchMock = vi.fn().mockResolvedValue(new Response("nope", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await getOrComputeWeeklyReview(currentWeekStart(), window.localStorage);
    expect(first.narrative.source).toBe("deterministic");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Same week state → served from cache, no extra network.
    const second = await getOrComputeWeeklyReview(currentWeekStart(), window.localStorage);
    expect(second.narrative.narrative).toBe(first.narrative.narrative);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // The week's data changed → new signature → recompute.
    seedThisWeekWorkout();
    await getOrComputeWeeklyReview(currentWeekStart(), window.localStorage);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("swaps in the AI narrative when the route returns a valid one", async () => {
    seedThisWeekWorkout();
    const aiNarrative: WeeklyReviewNarrative = {
      weekStart: currentWeekStart(),
      narrative: "Coach says: strong, focused week.",
      wins: [],
      focus: [],
      source: "ai",
      createdAt: NOW
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(aiNarrative), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
    );

    const { narrative } = await getOrComputeWeeklyReview(currentWeekStart(), window.localStorage);
    expect(narrative.source).toBe("ai");
    expect(narrative.narrative).toBe("Coach says: strong, focused week.");
  });

  it("builds the deterministic review synchronously and stable signatures", () => {
    seedThisWeekWorkout();
    const local = buildLocalWeeklyReview(window.localStorage, currentWeekStart());
    expect(local.review.training.totalSessions).toBe(1);
    expect(local.narrative.source).toBe("deterministic");

    const data = {
      weekStart: currentWeekStart(),
      workouts: createLocalWorkoutRepository(window.localStorage).load(),
      metrics: createLocalMetricRepository(window.localStorage).load(),
      foodEntries: createLocalFoodEntryRepository(window.localStorage).load(),
      targets: [],
      tasks: []
    };
    const a = buildWeeklyReviewSignature(currentWeekStart(), data);
    expect(buildWeeklyReviewSignature(currentWeekStart(), data)).toBe(a);
    seedThisWeekWorkout();
    const changed = {
      ...data,
      workouts: createLocalWorkoutRepository(window.localStorage).load()
    };
    expect(buildWeeklyReviewSignature(currentWeekStart(), changed)).not.toBe(a);
  });

  it("clears the cache on demand", async () => {
    seedThisWeekWorkout();
    upsertDailyTarget(window.localStorage, mkTarget(currentWeekStart(), 2000));
    const fetchMock = vi.fn().mockResolvedValue(new Response("nope", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    await getOrComputeWeeklyReview(currentWeekStart(), window.localStorage);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    clearWeeklyReviewCache(window.localStorage);
    await getOrComputeWeeklyReview(currentWeekStart(), window.localStorage);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
