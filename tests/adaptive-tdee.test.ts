import { afterEach, describe, expect, it } from "vitest";

import { buildTargetComputation } from "@/client/nutritionTarget";
import { saveBodyProfile } from "@/data/bodyProfileRepository";
import { saveHealthGoals } from "@/data/healthGoalsRepository";
import { createLocalFoodEntryRepository } from "@/data/foodEntryRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import {
  blendTdee,
  computeAdaptiveTdee,
  confidenceFromData,
  estimateExpenditure,
  smoothWeightTrend,
  targetFromTdee,
  type WeightSample
} from "@/domain/adaptiveTdee";
import { createFoodEntry } from "@/domain/nutrition";
import { createMetricEntry } from "@/domain/metrics";
import { defaultHealthGoals } from "@/domain/healthGoals";

function isoShift(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

describe("smoothWeightTrend", () => {
  it("returns null with fewer than two weigh-ins", () => {
    expect(smoothWeightTrend([{ date: "2026-06-01", weightLbs: 200 }])).toBeNull();
  });

  it("detects a downward slope", () => {
    const trend = smoothWeightTrend([
      { date: "2026-06-01", weightLbs: 202 },
      { date: "2026-06-08", weightLbs: 200 },
      { date: "2026-06-15", weightLbs: 198 }
    ])!;
    expect(trend.slopeLbPerWeek).toBeLessThan(0);
    expect(trend.deltaLb).toBeLessThan(0);
  });

  it("resists a single outlier (regression, not first-vs-last)", () => {
    const clean: WeightSample[] = [
      { date: "2026-06-01", weightLbs: 200 },
      { date: "2026-06-05", weightLbs: 200 },
      { date: "2026-06-09", weightLbs: 200 },
      { date: "2026-06-13", weightLbs: 205 } // water-weight spike on the last day
    ];
    const trend = smoothWeightTrend(clean)!;
    // Naive first-vs-last would report +5; the least-squares fit damps it.
    const naive = clean[clean.length - 1].weightLbs - clean[0].weightLbs; // 5
    expect(trend.deltaLb).toBeLessThan(naive);
  });
});

describe("estimateExpenditure (energy balance)", () => {
  it("adds back the deficit when losing weight", () => {
    // Ate 2500/day, lost 1 lb over 7 days → expenditure 3000.
    expect(estimateExpenditure(2500, -1, 7)).toBe(3000);
  });

  it("yields expenditure below intake when gaining on that intake", () => {
    // Ate 2500/day but gained 0.5 lb over 7 days → expenditure 2250.
    expect(estimateExpenditure(2500, 0.5, 7)).toBe(2250);
  });
});

describe("confidenceFromData", () => {
  it("is zero below the minimums", () => {
    expect(confidenceFromData({ loggedDays: 3, weighInSpanDays: 14, weighInDays: 3 })).toBe(0);
    expect(confidenceFromData({ loggedDays: 14, weighInSpanDays: 4, weighInDays: 3 })).toBe(0);
    expect(confidenceFromData({ loggedDays: 14, weighInSpanDays: 14, weighInDays: 1 })).toBe(0);
  });

  it("rises with more data and caps at 0.9", () => {
    const low = confidenceFromData({ loggedDays: 7, weighInSpanDays: 10, weighInDays: 2 });
    const high = confidenceFromData({ loggedDays: 30, weighInSpanDays: 40, weighInDays: 20 });
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(0.9);
  });
});

describe("blendTdee", () => {
  it("weights by confidence", () => {
    expect(blendTdee(2000, 2400, 0)).toBe(2000);
    expect(blendTdee(2000, 2400, 0.5)).toBe(2200);
  });

  it("clamps the learned value to ±25% of Mifflin", () => {
    // learned 3000 vs Mifflin 2000 at full confidence → clamp to 2500.
    expect(blendTdee(2000, 3000, 1)).toBe(2500);
    // learned 1000 → clamp to 1500.
    expect(blendTdee(2000, 1000, 1)).toBe(1500);
  });
});

describe("targetFromTdee", () => {
  it("applies the goal-rate deficit", () => {
    expect(targetFromTdee(3000, -1, 1500)).toBe(2500);
  });

  it("caps the deficit at 25% of TDEE", () => {
    // rate -3 → -1500/day, but cap is 750 → 2250.
    expect(targetFromTdee(3000, -3, 1500)).toBe(2250);
  });

  it("never drops below the calorie floor", () => {
    expect(targetFromTdee(1600, -3, 1500)).toBe(1500);
  });
});

describe("computeAdaptiveTdee", () => {
  it("falls back to Mifflin with no usable weight data", () => {
    const r = computeAdaptiveTdee({
      mifflinTdee: 2500,
      weightSamples: [],
      avgDailyIntake: 2500,
      loggedDays: 0,
      windowDays: 21
    });
    expect(r.confidence).toBe(0);
    expect(r.tdeeEstimate).toBe(2500);
    expect(r.learnedTdee).toBeNull();
  });

  it("revises TDEE DOWN when weight trends up on maintenance intake", () => {
    const samples: WeightSample[] = [];
    for (let i = 0; i <= 14; i += 2) {
      samples.push({ date: isoShift(-14 + i), weightLbs: 200 + i * 0.07 }); // ~+1 lb over 14d
    }
    const r = computeAdaptiveTdee({
      mifflinTdee: 2500,
      weightSamples: samples,
      avgDailyIntake: 2500,
      loggedDays: 14,
      windowDays: 14
    });
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.learnedTdee).not.toBeNull();
    expect(r.learnedTdee!).toBeLessThan(2500);
    expect(r.tdeeEstimate).toBeLessThan(2500);
  });
});

function seedAdaptiveHistory() {
  const now = new Date().toISOString();
  saveBodyProfile(window.localStorage, {
    sex: "male",
    age: 40,
    heightInches: 70,
    activityLevel: "moderate",
    setupCompleted: true,
    updatedAt: now
  });
  saveHealthGoals(window.localStorage, {
    ...defaultHealthGoals(now),
    weightTargetLbs: 200,
    weeklyWeightChangeTargetLbs: -1
  });

  const metrics = [];
  for (let i = 14; i >= 0; i -= 3) {
    metrics.push(
      createMetricEntry({ date: isoShift(-i), checkInType: "morning", weightLbs: 230 - (14 - i) * 0.1 })
    );
  }
  createLocalMetricRepository(window.localStorage).save(metrics);

  const foods = [];
  for (let i = 1; i <= 14; i += 1) {
    foods.push(
      createFoodEntry({
        date: isoShift(-i),
        mealType: "dinner",
        description: "Day intake",
        macros: { calories: 2400, proteinG: 160, carbsG: 250, fatG: 70 }
      })
    );
  }
  createLocalFoodEntryRepository(window.localStorage).save(foods);
}

describe("buildTargetComputation with adaptive history", () => {
  afterEach(() => window.localStorage.clear());

  it("produces an adaptive target once there is enough data", () => {
    seedAdaptiveHistory();
    const comp = buildTargetComputation(window.localStorage, isoShift(0), new Date().toISOString())!;
    expect(comp).not.toBeNull();
    expect(comp.adaptive.confidence).toBeGreaterThan(0);
    expect(comp.deterministic.source).toBe("adaptive");
    expect(comp.deterministic.calorieTarget).toBeGreaterThanOrEqual(comp.baseline.minCalories);
    expect(comp.deterministic.rationale).toMatch(/Adaptive/);
  });
});
