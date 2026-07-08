import { afterEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/ai/workout-suggestion/route";
import { suggestionToWorkoutInput } from "@/client/workoutSuggestion";
import { strengthWorkouts } from "@/config/fitness";
import { getDailyFitnessStatus } from "@/domain/dailyFitness";
import { createWorkout } from "@/domain/workouts";
import { defaultTrainingProfile } from "@/domain/trainingProfile";
import {
  buildDeterministicPlan,
  buildProgressivePlan,
  buildWorkoutCatalog,
  isDailyWorkoutPlan,
  parseDailyWorkoutPlan,
  pickSoloConditioning,
  soloConditioningSessions,
  type DailyWorkoutPlan
} from "@/domain/workoutPlan";
import { resetRateLimiter } from "@/server/ai/rateLimiter";
import {
  setWorkoutCoachForTests,
  type WorkoutSuggestionInput
} from "@/server/ai/workoutCoachClient";
import { AINotConfiguredError } from "@/server/ai/openaiClient";

const catalog = buildWorkoutCatalog();
const now = "2026-06-28T08:00:00.000Z";
const date = "2026-06-28";

describe("parseDailyWorkoutPlan", () => {
  it("keeps a valid preset and downgrades an invalid one to custom", () => {
    const plan = parseDailyWorkoutPlan(
      {
        items: [
          { bucket: "strength", kind: "preset", presetId: strengthWorkouts[0].id, title: "Push" },
          { bucket: "cardio", kind: "preset", presetId: "not-real", title: "Mystery cardio" }
        ]
      },
      catalog,
      date,
      now
    );
    const strength = plan.items.find((i) => i.bucket === "strength")!;
    const cardio = plan.items.find((i) => i.bucket === "cardio")!;
    expect(strength.kind).toBe("preset");
    expect(strength.presetId).toBe(strengthWorkouts[0].id);
    expect(strength.variant).toBe("Free Weight"); // defaulted
    expect(cardio.kind).toBe("custom"); // invalid preset → custom
    expect(cardio.presetId).toBeUndefined();
  });

  it("keeps one suggestion per bucket and tolerates garbage", () => {
    const plan = parseDailyWorkoutPlan(
      {
        items: [
          { bucket: "cardio", kind: "preset", presetId: "walk", title: "Walk A" },
          { bucket: "cardio", kind: "preset", presetId: "run", title: "Walk B (dup)" },
          { bucket: "bogus" },
          null
        ]
      },
      catalog,
      date,
      now
    );
    const cardios = plan.items.filter((i) => i.bucket === "cardio");
    expect(cardios).toHaveLength(1);
    expect(cardios[0].title).toBe("Walk A");
  });
});

describe("parseDailyWorkoutPlan prescriptions", () => {
  it("parses strength prescriptions and drops garbage entries", () => {
    const plan = parseDailyWorkoutPlan(
      {
        items: [
          {
            bucket: "strength",
            kind: "custom",
            title: "Bench day",
            progressionSummary: "Bench moving up — 185 → 190.",
            prescriptions: [
              { exercise: "Barbell Bench Press", sets: 5, reps: 5, weightLbs: 190, note: "Take 190 today." },
              { exercise: "Push-Up", sets: 3, reps: 12 },
              { exercise: "", sets: 3, reps: 8 }, // no name → dropped
              { exercise: "Ghost", sets: 0, reps: 8 }, // bad sets → dropped
              { exercise: "Nonsense", sets: 3, reps: "lots" } // bad reps → dropped
            ]
          }
        ]
      },
      catalog,
      date,
      now
    );
    const strength = plan.items.find((i) => i.bucket === "strength")!;
    expect(strength.prescriptions).toHaveLength(2);
    expect(strength.prescriptions![0]).toMatchObject({
      exercise: "Barbell Bench Press",
      sets: 5,
      reps: 5,
      weightLbs: 190
    });
    expect(strength.prescriptions![1].weightLbs).toBeUndefined();
    expect(strength.progressionSummary).toContain("Bench moving up");
  });

  it("ignores prescriptions on non-strength buckets", () => {
    const plan = parseDailyWorkoutPlan(
      {
        items: [
          {
            bucket: "cardio",
            kind: "preset",
            presetId: "walk",
            title: "Walk",
            prescriptions: [{ exercise: "Sprint", sets: 5, reps: 5 }]
          }
        ]
      },
      catalog,
      date,
      now
    );
    expect(plan.items[0].prescriptions).toBeUndefined();
  });

  it("keeps backward compat: old cached plans without prescriptions still validate", () => {
    const oldPlan = {
      date,
      items: [
        { bucket: "strength", kind: "preset", presetId: "day-1", variant: "Free Weight", title: "Push", rationale: "" }
      ],
      source: "ai",
      createdAt: now
    };
    expect(isDailyWorkoutPlan(oldPlan)).toBe(true);
    const reparsed = parseDailyWorkoutPlan(oldPlan, catalog, date, now);
    expect(reparsed.items[0].prescriptions).toBeUndefined();
  });
});

describe("buildProgressivePlan", () => {
  const profile = defaultTrainingProfile(now);

  it("carries real programming: prescriptions + progression summary on strength", () => {
    const plan = buildProgressivePlan(profile, [], date, now);
    expect(plan.source).toBe("computed");
    const strength = plan.items.find((i) => i.bucket === "strength")!;
    expect(strength.kind).toBe("custom");
    expect(strength.prescriptions!.length).toBeGreaterThanOrEqual(3);
    expect(strength.progressionSummary).toBeTruthy();
    expect(strength.exercises!.length).toBe(strength.prescriptions!.length);
  });

  it("uses solo conditioning for martial arts on non-class days", () => {
    const plan = buildProgressivePlan(profile, [], date, now, { karateToday: false });
    const ma = plan.items.find((i) => i.bucket === "martial_arts")!;
    expect(soloConditioningSessions.map((s) => s.title)).toContain(ma.title);
    expect(ma.description).toBeTruthy();
  });

  it("marks karate class as the martial-arts session on class days", () => {
    const plan = buildProgressivePlan(profile, [], date, now, { karateToday: true });
    const ma = plan.items.find((i) => i.bucket === "martial_arts")!;
    expect(ma.title).toBe("Karate class ✓ counts as today's session");
    expect(ma.description).toMatch(/10-min mobility cooldown/);
  });

  it("rotates solo conditioning across consecutive days", () => {
    const titles = ["2026-06-25", "2026-06-26", "2026-06-27", "2026-06-28"].map(
      (d) => pickSoloConditioning(d).title
    );
    expect(new Set(titles).size).toBe(4);
  });
});

describe("buildDeterministicPlan", () => {
  it("returns three valid-preset sessions and rotates strength", () => {
    const plan = buildDeterministicPlan(["Day 1 — Chest & Biceps · Free Weight"], date, now);
    expect(plan.source).toBe("computed");
    expect(plan.items).toHaveLength(3);
    const strength = plan.items.find((i) => i.bucket === "strength")!;
    // last was day 1 → rotate to day 2
    expect(strength.presetId).toBe("day-2");
    // every preset id is real
    for (const item of plan.items) {
      expect(catalog[item.bucket].some((o) => o.id === item.presetId)).toBe(true);
    }
  });
});

describe("getDailyFitnessStatus good-day / bonus", () => {
  function w(type: "strength" | "cardio" | "martial_arts") {
    return createWorkout({ date, type, source: "manual", title: type });
  }

  it("one session is a good day; extras are bonus", () => {
    expect(getDailyFitnessStatus([], date).isGoodDay).toBe(false);
    const one = getDailyFitnessStatus([w("strength")], date);
    expect(one.isGoodDay).toBe(true);
    expect(one.bonusCount).toBe(0);
    const two = getDailyFitnessStatus([w("strength"), w("cardio")], date);
    expect(two.bonusCount).toBe(1);
    const three = getDailyFitnessStatus([w("strength"), w("cardio"), w("martial_arts")], date);
    expect(three.isComplete).toBe(true);
    expect(three.bonusCount).toBe(2);
  });
});

describe("suggestionToWorkoutInput", () => {
  it("maps a strength preset to titled sets + equipment", () => {
    const input = suggestionToWorkoutInput(
      {
        bucket: "strength",
        kind: "preset",
        presetId: strengthWorkouts[0].id,
        variant: "Free Weight",
        title: "x",
        rationale: ""
      },
      date
    );
    expect(input.type).toBe("strength");
    expect(input.source).toBe("ai");
    expect((input.sets ?? []).length).toBeGreaterThan(0);
    expect(input.equipment).toBeDefined();
  });

  it("expands prescriptions into per-set entries with reps + load", () => {
    const input = suggestionToWorkoutInput(
      {
        bucket: "strength",
        kind: "custom",
        title: "Bench day — simple progression",
        rationale: "",
        progressionSummary: "Bench moving 185 → 190.",
        prescriptions: [
          { exercise: "Barbell Bench Press", sets: 5, reps: 5, weightLbs: 190 },
          { exercise: "Incline Dumbbell Press", sets: 3, reps: 8, weightLbs: 50 }
        ]
      },
      date
    );
    expect(input.sets).toHaveLength(8);
    expect(input.sets![0]).toEqual({ exercise: "Barbell Bench Press", reps: 5, weightLbs: 190 });
    expect(input.sets![7]).toEqual({ exercise: "Incline Dumbbell Press", reps: 8, weightLbs: 50 });
    expect(input.notes).toContain("185 → 190");
  });

  it("maps a cardio suggestion to duration", () => {
    const input = suggestionToWorkoutInput(
      { bucket: "cardio", kind: "preset", presetId: "walk", title: "Walk", estMinutes: 30, rationale: "" },
      date
    );
    expect(input.type).toBe("cardio");
    expect(input.durationMinutes).toBe(30);
  });
});

describe("/api/ai/workout-suggestion", () => {
  afterEach(() => {
    resetRateLimiter();
    setWorkoutCoachForTests(undefined);
  });

  function req(body: unknown): Request {
    return new Request("http://localhost/api/ai/workout-suggestion", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  it("rejects a missing date", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it("returns a plan on success", async () => {
    const plan: DailyWorkoutPlan = {
      date,
      items: [
        { bucket: "strength", kind: "preset", presetId: "day-1", variant: "Free Weight", title: "Push", rationale: "go" }
      ],
      source: "ai",
      createdAt: now
    };
    setWorkoutCoachForTests(async () => plan);
    const res = await POST(req({ date }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items[0].presetId).toBe("day-1");
  });

  it("forwards profile, progression context and karateToday to the coach", async () => {
    const plan: DailyWorkoutPlan = { date, items: [], source: "ai", createdAt: now };
    let received: WorkoutSuggestionInput | undefined;
    setWorkoutCoachForTests(async (input) => {
      received = input;
      return plan;
    });
    const res = await POST(
      req({
        date,
        profileSummary: "Equipment: kettlebells, dumbbells, barbell.",
        progressionSummary: "Barbell Bench Press: last 185×5.",
        karateToday: true
      })
    );
    expect(res.status).toBe(200);
    expect(received?.profileSummary).toContain("kettlebells");
    expect(received?.progressionSummary).toContain("185");
    expect(received?.karateToday).toBe(true);
  });

  it("maps AINotConfiguredError to 503", async () => {
    setWorkoutCoachForTests(async () => {
      throw new AINotConfiguredError();
    });
    const res = await POST(req({ date }));
    expect(res.status).toBe(503);
  });
});
