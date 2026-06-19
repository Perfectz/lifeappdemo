import { describe, expect, it } from "vitest";

import { computeBosses } from "@/domain/bosses";
import { defaultHealthGoals, withGoalEdits } from "@/domain/healthGoals";
import type { MetricEntry } from "@/domain";

const today = "2026-06-19";

function metric(overrides: Partial<MetricEntry>): MetricEntry {
  return {
    id: overrides.id ?? "m1",
    date: overrides.date ?? today,
    checkInType: "morning",
    source: "manual",
    recordedAt: overrides.recordedAt ?? `${today}T08:00:00.000Z`,
    createdAt: `${today}T08:00:00.000Z`,
    updatedAt: `${today}T08:00:00.000Z`,
    ...overrides
  };
}

describe("boss battles", () => {
  it("locks bosses with no data to fight", () => {
    const bosses = computeBosses({ today, metrics: [], goals: defaultHealthGoals() });
    const hypertension = bosses.find((b) => b.id === "hypertension");
    expect(hypertension?.engaged).toBe(false);
    expect(hypertension?.defeated).toBe(false);
  });

  it("engages and damages the hypertension boss with a high reading", () => {
    const bosses = computeBosses({
      today,
      metrics: [metric({ bloodPressureSystolic: 150, bloodPressureDiastolic: 95 })],
      goals: defaultHealthGoals()
    });
    const boss = bosses.find((b) => b.id === "hypertension");
    expect(boss?.engaged).toBe(true);
    expect(boss?.hp).toBeGreaterThan(0);
    expect(boss?.defeated).toBe(false);
  });

  it("defeats the hypertension boss when BP is in range", () => {
    const bosses = computeBosses({
      today,
      metrics: [metric({ bloodPressureSystolic: 122, bloodPressureDiastolic: 78 })],
      goals: defaultHealthGoals()
    });
    const boss = bosses.find((b) => b.id === "hypertension");
    expect(boss?.hp).toBe(0);
    expect(boss?.defeated).toBe(true);
  });

  it("drains the plateau boss as weight approaches the goal", () => {
    const goals = withGoalEdits(defaultHealthGoals(), { weightStartLbs: 230, weightTargetLbs: 200 });
    const bosses = computeBosses({ today, metrics: [metric({ weightLbs: 215 })], goals });
    const plateau = bosses.find((b) => b.id === "plateau");
    expect(plateau?.engaged).toBe(true);
    expect(plateau?.hp).toBe(50); // halfway = 50% HP left
  });
});
