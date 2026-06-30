import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/ai/nutrition-target/route";
import {
  buildTargetComputation,
  getOrComputeDailyTarget
} from "@/client/nutritionTarget";
import { saveBodyProfile } from "@/data/bodyProfileRepository";
import { saveHealthGoals } from "@/data/healthGoalsRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { resetRateLimiter } from "@/server/ai/rateLimiter";
import { setNutritionTargetForTests } from "@/server/ai/nutritionTargetClient";
import { AINotConfiguredError } from "@/server/ai/openaiClient";
import {
  parseDailyNutritionTarget,
  type DailyNutritionTarget,
  type TargetBaseline
} from "@/domain/dailyNutritionTarget";
import { defaultHealthGoals } from "@/domain/healthGoals";
import { createMetricEntry } from "@/domain/metrics";
import { toLocalIsoDate } from "@/domain/dates";

const baseline: TargetBaseline = {
  recommendedCalories: 2000,
  proteinTargetG: 160,
  carbsTargetG: 180,
  fatTargetG: 56,
  minCalories: 1500
};

describe("parseDailyNutritionTarget guardrails", () => {
  const date = "2026-06-28";
  const now = "2026-06-28T12:00:00.000Z";

  it("clamps calories into the safe band around the baseline", () => {
    // 2000 ±18% → [1640, 2360]; floor 1500.
    expect(parseDailyNutritionTarget({ calorieTarget: 5000 }, baseline, date, now).calorieTarget).toBe(2360);
    expect(parseDailyNutritionTarget({ calorieTarget: 500 }, baseline, date, now).calorieTarget).toBe(1640);
  });

  it("never drops below the calorie floor", () => {
    const lowFloor: TargetBaseline = { ...baseline, recommendedCalories: 1600, minCalories: 1500 };
    // 1600 -18% = 1312, but floor is 1500.
    expect(parseDailyNutritionTarget({ calorieTarget: 800 }, lowFloor, date, now).calorieTarget).toBe(1500);
  });

  it("falls back to baseline macros when omitted and stays coherent", () => {
    const t = parseDailyNutritionTarget({ calorieTarget: 2000 }, baseline, date, now);
    expect(t.proteinTargetG).toBe(160);
    expect(t.fatTargetG).toBe(56);
    expect(t.carbsTargetG).toBeGreaterThan(0);
    expect(t.source).toBe("ai");
  });

  it("is tolerant of garbage", () => {
    const t = parseDailyNutritionTarget(null, baseline, date, now);
    expect(t.calorieTarget).toBe(2000);
    expect(t.date).toBe(date);
  });
});

function seedFullProfile() {
  const now = "2026-06-28T08:00:00.000Z";
  saveBodyProfile(window.localStorage, {
    sex: "male",
    age: 40,
    heightInches: 70,
    activityLevel: "moderate",
    setupCompleted: true,
    updatedAt: now
  });
  saveHealthGoals(window.localStorage, { ...defaultHealthGoals(now), weightTargetLbs: 200 });
  const entry = createMetricEntry({
    date: toLocalIsoDate(),
    checkInType: "morning",
    weightLbs: 230
  });
  createLocalMetricRepository(window.localStorage).save([entry]);
}

describe("buildTargetComputation", () => {
  afterEach(() => window.localStorage.clear());

  it("returns null without complete body stats", () => {
    expect(buildTargetComputation(window.localStorage, "2026-06-28", "2026-06-28T00:00:00.000Z")).toBeNull();
  });

  it("computes a deterministic deficit target from metrics", () => {
    seedFullProfile();
    const comp = buildTargetComputation(window.localStorage, toLocalIsoDate(), "2026-06-28T08:00:00.000Z");
    expect(comp).not.toBeNull();
    expect(comp!.goal).toBe("lose");
    expect(comp!.deterministic.source).toBe("computed");
    expect(comp!.deterministic.calorieTarget).toBeGreaterThanOrEqual(baseline.minCalories);
    expect(comp!.baseline.recommendedCalories).toBeGreaterThan(0);
  });
});

describe("getOrComputeDailyTarget", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("falls back to the deterministic target when the AI call fails, then caches it", async () => {
    seedFullProfile();
    const fetchMock = vi.fn().mockResolvedValue(new Response("nope", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await getOrComputeDailyTarget(window.localStorage);
    expect(first?.source).toBe("computed");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second call uses the cache — no further network.
    const second = await getOrComputeDailyTarget(window.localStorage);
    expect(second?.calorieTarget).toBe(first?.calorieTarget);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses the AI target when the route returns a valid one", async () => {
    seedFullProfile();
    const aiTarget: DailyNutritionTarget = {
      date: toLocalIsoDate(),
      calorieTarget: 1850,
      proteinTargetG: 170,
      carbsTargetG: 150,
      fatTargetG: 55,
      rationale: "Rest day — slightly lower.",
      source: "ai",
      createdAt: "2026-06-28T08:00:00.000Z"
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(aiTarget), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
    );
    const target = await getOrComputeDailyTarget(window.localStorage);
    expect(target?.source).toBe("ai");
    expect(target?.calorieTarget).toBe(1850);
  });
});

describe("/api/ai/nutrition-target", () => {
  afterEach(() => {
    resetRateLimiter();
    setNutritionTargetForTests(undefined);
  });

  function req(body: unknown): Request {
    return new Request("http://localhost/api/ai/nutrition-target", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  it("rejects a missing baseline", async () => {
    const res = await POST(req({ date: "2026-06-28" }));
    expect(res.status).toBe(400);
  });

  it("returns the suggested target on success", async () => {
    setNutritionTargetForTests(async (input) => ({
      date: input.date,
      calorieTarget: 1900,
      proteinTargetG: 165,
      carbsTargetG: 160,
      fatTargetG: 55,
      rationale: "ok",
      source: "ai",
      createdAt: "2026-06-28T08:00:00.000Z"
    }));
    const res = await POST(req({ date: "2026-06-28", baseline }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.calorieTarget).toBe(1900);
  });

  it("maps AINotConfiguredError to 503", async () => {
    setNutritionTargetForTests(async () => {
      throw new AINotConfiguredError();
    });
    const res = await POST(req({ date: "2026-06-28", baseline }));
    expect(res.status).toBe(503);
  });
});
