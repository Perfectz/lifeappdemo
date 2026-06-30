import { afterEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/ai/workout-suggestion/route";
import { suggestionToWorkoutInput } from "@/client/workoutSuggestion";
import { strengthWorkouts } from "@/config/fitness";
import { getDailyFitnessStatus } from "@/domain/dailyFitness";
import { createWorkout } from "@/domain/workouts";
import {
  buildDeterministicPlan,
  buildWorkoutCatalog,
  parseDailyWorkoutPlan,
  type DailyWorkoutPlan
} from "@/domain/workoutPlan";
import { resetRateLimiter } from "@/server/ai/rateLimiter";
import { setWorkoutCoachForTests } from "@/server/ai/workoutCoachClient";
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

  it("maps AINotConfiguredError to 503", async () => {
    setWorkoutCoachForTests(async () => {
      throw new AINotConfiguredError();
    });
    const res = await POST(req({ date }));
    expect(res.status).toBe(503);
  });
});
