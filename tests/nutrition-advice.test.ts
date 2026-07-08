import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/ai/nutrition-advice/route";
import {
  buildAdviceSignature,
  buildDeterministicAdvice,
  clearAdviceCache,
  getOrComputeDailyAdvice
} from "@/client/nutritionAdvice";
import { upsertDailyTarget } from "@/data/dailyNutritionTargetRepository";
import { createLocalFoodEntryRepository } from "@/data/foodEntryRepository";
import { toLocalIsoDate } from "@/domain/dates";
import type { DailyNutritionTarget } from "@/domain/dailyNutritionTarget";
import { createFoodEntry } from "@/domain/nutrition";
import {
  buildNutritionAdvice,
  clampAdviceFromAI,
  dayPhase,
  fiberTargetFromCalories,
  formatGapLabel,
  isNutritionAdvice,
  type NutritionAdvice
} from "@/domain/nutritionAdvice";
import type { FoodEntry, IsoDate } from "@/domain";
import { setNutritionAdviceForTests } from "@/server/ai/nutritionAdviceClient";
import { AINotConfiguredError } from "@/server/ai/openaiClient";
import { resetRateLimiter } from "@/server/ai/rateLimiter";

const DATE: IsoDate = "2026-07-07";
const NOW = "2026-07-07T12:00:00.000Z";

function mkTarget(calorieTarget = 2000, proteinTargetG = 160): DailyNutritionTarget {
  return {
    date: DATE,
    calorieTarget,
    proteinTargetG,
    carbsTargetG: 180,
    fatTargetG: 56,
    rationale: "test",
    source: "computed",
    createdAt: NOW
  };
}

function mkEntry(macros: {
  calories?: number;
  proteinG?: number;
  fiberG?: number;
}): FoodEntry {
  return createFoodEntry(
    { date: DATE, mealType: "lunch", description: "test food", macros },
    NOW
  );
}

const MORNING = 8 * 60;
const MIDDAY = 13 * 60;
const EVENING = 19 * 60;

describe("dayPhase", () => {
  it("splits the day at 11:00 and 17:00", () => {
    expect(dayPhase(MORNING)).toBe("morning");
    expect(dayPhase(11 * 60)).toBe("midday");
    expect(dayPhase(MIDDAY)).toBe("midday");
    expect(dayPhase(17 * 60)).toBe("evening");
    expect(dayPhase(EVENING)).toBe("evening");
  });
});

describe("buildNutritionAdvice — deterministic engine", () => {
  it("points to profile setup when there is no target", () => {
    const advice = buildNutritionAdvice({
      date: DATE,
      now: NOW,
      target: null,
      entriesToday: [],
      nowMinutes: MIDDAY
    });
    expect(advice.verdict).toMatch(/profile/i);
    expect(advice.gaps).toEqual([]);
    expect(advice.warnings).toEqual([]);
    expect(advice.source).toBe("deterministic");
  });

  it("handles an empty diary in the morning with a day plan", () => {
    const advice = buildNutritionAdvice({
      date: DATE,
      now: NOW,
      target: mkTarget(),
      entriesToday: [],
      nowMinutes: MORNING
    });
    expect(advice.verdict).toContain("Nothing logged yet");
    expect(advice.verdict).toContain("2000 kcal");
    expect(advice.verdict).toContain("160g protein");
    expect(advice.timing).toMatch(/plan the day/i);
    expect(advice.gaps).toEqual([]);
    expect(advice.warnings).toEqual([]);
  });

  it("warns about the unlogged day in the evening", () => {
    const advice = buildNutritionAdvice({
      date: DATE,
      now: NOW,
      target: mkTarget(),
      entriesToday: [],
      nowMinutes: EVENING
    });
    expect(advice.warnings.some((w) => /unlogged/i.test(w))).toBe(true);
  });

  it("flags a protein gap with concrete food suggestions", () => {
    const advice = buildNutritionAdvice({
      date: DATE,
      now: NOW,
      target: mkTarget(2000, 160),
      entriesToday: [mkEntry({ calories: 1400, proteinG: 100, fiberG: 30 })],
      nowMinutes: MIDDAY
    });
    const protein = advice.gaps.find((gap) => gap.nutrient === "protein");
    expect(protein).toBeDefined();
    expect(protein!.short).toBe(60);
    expect(protein!.suggestion).toMatch(/chicken|shake|yogurt/i);
    // Plenty of fiber logged — no fiber gap.
    expect(advice.gaps.some((gap) => gap.nutrient === "fiber")).toBe(false);
  });

  it("skips protein shortfalls below the 10g noise floor", () => {
    const advice = buildNutritionAdvice({
      date: DATE,
      now: NOW,
      target: mkTarget(2000, 160),
      entriesToday: [mkEntry({ calories: 1900, proteinG: 155, fiberG: 30 })],
      nowMinutes: EVENING
    });
    expect(advice.gaps.some((gap) => gap.nutrient === "protein")).toBe(false);
  });

  it("flags a fiber gap from the calorie-derived fiber goal", () => {
    expect(fiberTargetFromCalories(2000)).toBe(28);
    const advice = buildNutritionAdvice({
      date: DATE,
      now: NOW,
      target: mkTarget(2000, 160),
      entriesToday: [mkEntry({ calories: 1200, proteinG: 150, fiberG: 5 })],
      nowMinutes: MIDDAY
    });
    const fiber = advice.gaps.find((gap) => gap.nutrient === "fiber");
    expect(fiber).toBeDefined();
    expect(fiber!.short).toBe(23);
    expect(fiber!.suggestion).toMatch(/berries|beans|lentils|vegetable/i);
  });

  it("warns and goes light when over budget, with no calorie gap", () => {
    const advice = buildNutritionAdvice({
      date: DATE,
      now: NOW,
      target: mkTarget(2000, 160),
      entriesToday: [mkEntry({ calories: 2300, proteinG: 160, fiberG: 30 })],
      nowMinutes: EVENING
    });
    expect(advice.verdict).toContain("Over budget");
    expect(advice.verdict).toContain("300 kcal");
    expect(
      advice.warnings.some((w) => w.includes("300 kcal over target") && /dinner light/i.test(w))
    ).toBe(true);
    expect(advice.gaps.some((gap) => gap.nutrient === "calories")).toBe(false);
  });

  it("produces evening, dinner-sized advice when on track", () => {
    const advice = buildNutritionAdvice({
      date: DATE,
      now: NOW,
      target: mkTarget(2000, 160),
      entriesToday: [mkEntry({ calories: 1380, proteinG: 112, fiberG: 30 })],
      nowMinutes: EVENING
    });
    expect(advice.verdict).toBe("On track — 620 kcal and 48g protein left, dinner-sized.");
    expect(advice.timing).toMatch(/dinner/i);
    expect(advice.timing).toContain("620");
    const calories = advice.gaps.find((gap) => gap.nutrient === "calories");
    expect(calories?.short).toBe(620);
  });

  it("tells the user to hold the line once the target is hit", () => {
    const advice = buildNutritionAdvice({
      date: DATE,
      now: NOW,
      target: mkTarget(2000, 160),
      entriesToday: [mkEntry({ calories: 1980, proteinG: 158, fiberG: 30 })],
      nowMinutes: EVENING
    });
    expect(advice.verdict).toMatch(/day handled/i);
    expect(advice.timing).toMatch(/hold the line/i);
    expect(advice.gaps).toEqual([]);
  });

  it("adds a carb note to dinner on training days", () => {
    const advice = buildNutritionAdvice({
      date: DATE,
      now: NOW,
      target: mkTarget(2000, 160),
      entriesToday: [mkEntry({ calories: 1380, proteinG: 112, fiberG: 30 })],
      nowMinutes: EVENING,
      trainedToday: true
    });
    expect(advice.timing).toMatch(/carb/i);
  });

  it("warns when the protein gap barely fits the calorie room", () => {
    // 40g short, only 100 kcal left (< 40 * 4).
    const advice = buildNutritionAdvice({
      date: DATE,
      now: NOW,
      target: mkTarget(2000, 160),
      entriesToday: [mkEntry({ calories: 1900, proteinG: 120, fiberG: 30 })],
      nowMinutes: EVENING
    });
    expect(advice.warnings.some((w) => /go lean|lean/i.test(w))).toBe(true);
  });

  it("warns when weight is dropping too fast", () => {
    const advice = buildNutritionAdvice({
      date: DATE,
      now: NOW,
      target: mkTarget(2000, 160),
      entriesToday: [mkEntry({ calories: 1000, proteinG: 100, fiberG: 30 })],
      nowMinutes: MIDDAY,
      weightDelta7d: -3.5
    });
    expect(advice.warnings.some((w) => /down 3\.5 lb/i.test(w))).toBe(true);
  });

  it("formats gap labels for display", () => {
    expect(formatGapLabel({ nutrient: "protein", short: 48, suggestion: "" })).toBe(
      "~48g protein short"
    );
    expect(formatGapLabel({ nutrient: "calories", short: 620, suggestion: "" })).toBe(
      "~620 kcal unspent"
    );
  });
});

describe("clampAdviceFromAI", () => {
  const deterministic = buildNutritionAdvice({
    date: DATE,
    now: NOW,
    target: mkTarget(2000, 160),
    entriesToday: [mkEntry({ calories: 1380, proteinG: 112, fiberG: 30 })],
    nowMinutes: EVENING
  });

  it("keeps the deterministic numbers while accepting AI wording", () => {
    const clamped = clampAdviceFromAI(
      {
        verdict: "Nice work — a dinner-sized finish is all that's left.",
        gaps: [{ nutrient: "protein", suggestion: "your usual grilled chicken and rice bowl" }],
        warnings: [],
        timing: "Keep dinner steady and call it a day."
      },
      deterministic,
      NOW
    );
    expect(clamped.source).toBe("ai");
    expect(clamped.verdict).toContain("dinner-sized finish");
    const protein = clamped.gaps.find((gap) => gap.nutrient === "protein");
    expect(protein!.short).toBe(48); // number is ground truth
    expect(protein!.suggestion).toContain("chicken and rice bowl");
    // Gaps the AI didn't rewrite keep the deterministic suggestion.
    const calories = clamped.gaps.find((gap) => gap.nutrient === "calories");
    expect(calories!.short).toBe(620);
    expect(calories!.suggestion).toBe(
      deterministic.gaps.find((gap) => gap.nutrient === "calories")!.suggestion
    );
  });

  it("never lets the AI invent warnings or gaps", () => {
    const clamped = clampAdviceFromAI(
      {
        verdict: "You should fast tomorrow.",
        gaps: [
          { nutrient: "protein", suggestion: "ok" },
          { nutrient: "fat", suggestion: "made-up gap" }
        ],
        warnings: ["Scary invented warning!"],
        timing: ""
      },
      deterministic,
      NOW
    );
    // deterministic advice here has no warnings → AI can't add any.
    expect(clamped.warnings).toEqual([]);
    // gap set mirrors the deterministic one exactly (nutrients + shorts).
    expect(clamped.gaps.map((gap) => gap.nutrient)).toEqual(
      deterministic.gaps.map((gap) => gap.nutrient)
    );
    // empty timing falls back.
    expect(clamped.timing).toBe(deterministic.timing);
  });

  it("is tolerant of garbage", () => {
    const clamped = clampAdviceFromAI(null, deterministic, NOW);
    expect(clamped.verdict).toBe(deterministic.verdict);
    expect(clamped.gaps).toEqual(deterministic.gaps);
    expect(isNutritionAdvice(clamped)).toBe(true);
  });
});

function seedTodayTarget(calorieTarget = 2000, proteinTargetG = 160): DailyNutritionTarget {
  const target: DailyNutritionTarget = {
    ...mkTarget(calorieTarget, proteinTargetG),
    date: toLocalIsoDate()
  };
  upsertDailyTarget(window.localStorage, target);
  return target;
}

function seedFood(calories: number, proteinG: number): void {
  const repo = createLocalFoodEntryRepository(window.localStorage);
  const entry = createFoodEntry({
    date: toLocalIsoDate(),
    mealType: "lunch",
    description: "seeded lunch",
    macros: { calories, proteinG }
  });
  repo.save([entry, ...repo.load()]);
}

describe("getOrComputeDailyAdvice", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("returns deterministic setup advice without a target and never calls the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const advice = await getOrComputeDailyAdvice(window.localStorage);
    expect(advice.source).toBe("deterministic");
    expect(advice.verdict).toMatch(/profile/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to deterministic advice when the AI call fails, then caches by signature", async () => {
    const target = seedTodayTarget();
    seedFood(1200, 90);
    const fetchMock = vi.fn().mockResolvedValue(new Response("nope", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await getOrComputeDailyAdvice(window.localStorage, target);
    expect(first.source).toBe("deterministic");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Same diary state → served from cache, no extra network.
    const second = await getOrComputeDailyAdvice(window.localStorage, target);
    expect(second.verdict).toBe(first.verdict);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Diary meaningfully changed → new signature → recompute.
    seedFood(400, 30);
    await getOrComputeDailyAdvice(window.localStorage, target);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses the AI advice when the route returns a valid one", async () => {
    const target = seedTodayTarget();
    seedFood(1200, 90);
    const aiAdvice: NutritionAdvice = {
      date: toLocalIsoDate(),
      verdict: "Coach says: cruising.",
      gaps: [{ nutrient: "protein", short: 70, suggestion: "chicken at dinner" }],
      warnings: [],
      timing: "Dinner-sized finish.",
      source: "ai",
      createdAt: NOW
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(aiAdvice), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
    );

    const advice = await getOrComputeDailyAdvice(window.localStorage, target);
    expect(advice.source).toBe("ai");
    expect(advice.verdict).toBe("Coach says: cruising.");
  });

  it("builds signatures that change with the diary and target", () => {
    const target = mkTarget();
    const empty = buildAdviceSignature(DATE, target, []);
    const withFood = buildAdviceSignature(DATE, target, [mkEntry({ calories: 500, proteinG: 30 })]);
    const noTarget = buildAdviceSignature(DATE, null, []);
    expect(empty).not.toBe(withFood);
    expect(empty).not.toBe(noTarget);
    expect(buildAdviceSignature(DATE, target, [])).toBe(empty);
  });

  it("clears the cache on demand", async () => {
    const target = seedTodayTarget();
    const fetchMock = vi.fn().mockResolvedValue(new Response("nope", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    await getOrComputeDailyAdvice(window.localStorage, target);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    clearAdviceCache(window.localStorage);
    await getOrComputeDailyAdvice(window.localStorage, target);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("buildDeterministicAdvice", () => {
  afterEach(() => window.localStorage.clear());

  it("reads today's diary from storage", () => {
    const target = seedTodayTarget();
    seedFood(2400, 160);
    const advice = buildDeterministicAdvice(window.localStorage, toLocalIsoDate(), target);
    expect(advice.verdict).toContain("Over budget");
  });
});

describe("/api/ai/nutrition-advice", () => {
  afterEach(() => {
    resetRateLimiter();
    setNutritionAdviceForTests(undefined);
  });

  function req(body: unknown): Request {
    return new Request("http://localhost/api/ai/nutrition-advice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  const deterministic = buildNutritionAdvice({
    date: "2026-07-07",
    now: NOW,
    target: mkTarget(),
    entriesToday: [mkEntry({ calories: 1380, proteinG: 112, fiberG: 30 })],
    nowMinutes: EVENING
  });

  it("rejects a missing date", async () => {
    const res = await POST(req({ deterministic }));
    expect(res.status).toBe(400);
  });

  it("rejects missing/invalid deterministic advice", async () => {
    const res = await POST(req({ date: "2026-07-07", deterministic: { verdict: 42 } }));
    expect(res.status).toBe(400);
  });

  it("returns the rewritten advice on success", async () => {
    setNutritionAdviceForTests(async (input) => ({
      ...input.deterministic,
      verdict: "Rewritten by coach.",
      source: "ai"
    }));
    const res = await POST(req({ date: "2026-07-07", deterministic }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.verdict).toBe("Rewritten by coach.");
    expect(data.source).toBe("ai");
  });

  it("maps AINotConfiguredError to 503", async () => {
    setNutritionAdviceForTests(async () => {
      throw new AINotConfiguredError();
    });
    const res = await POST(req({ date: "2026-07-07", deterministic }));
    expect(res.status).toBe(503);
  });
});
