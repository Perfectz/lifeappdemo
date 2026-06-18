import { describe, expect, it } from "vitest";

import { computeDailyAlignment } from "@/domain/alignment";
import { defaultHealthGoals } from "@/domain/healthGoals";
import type { MetricEntry, Workout } from "@/domain";

const today = "2026-06-18";
const goals = defaultHealthGoals();

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

function workout(type: Workout["type"]): Workout {
  return {
    id: `w-${type}`,
    date: today,
    type,
    title: type,
    durationMinutes: 30,
    recordedAt: `${today}T10:00:00.000Z`,
    createdAt: `${today}T10:00:00.000Z`,
    updatedAt: `${today}T10:00:00.000Z`
  } as Workout;
}

describe("daily alignment", () => {
  it("scores zero with nothing logged", () => {
    const result = computeDailyAlignment({ today, metrics: [], workouts: [], goals });
    expect(result.score).toBe(0);
    expect(result.percent).toBe(0);
    expect(result.level).toBe("not_started");
    expect(result.max).toBe(100);
  });

  it("awards points for in-range vitals and all three sessions", () => {
    const metrics = [
      metric({
        bloodGlucoseMgDl: 95,
        glucoseContext: "fasting",
        bloodPressureSystolic: 122,
        bloodPressureDiastolic: 78,
        weightLbs: 220
      })
    ];
    const workouts = [workout("strength"), workout("cardio"), workout("martial_arts")];
    const result = computeDailyAlignment({ today, metrics, workouts, goals });
    expect(result.score).toBe(100);
    expect(result.percent).toBe(100);
    expect(result.level).toBe("strongly_aligned");
  });

  it("gives logging credit but withholds in-range points when vitals are high", () => {
    const metrics = [
      metric({
        bloodGlucoseMgDl: 180,
        glucoseContext: "fasting",
        bloodPressureSystolic: 150,
        bloodPressureDiastolic: 95,
        weightLbs: 220
      })
    ];
    const result = computeDailyAlignment({ today, metrics, workouts: [], goals });
    // glucose+bp+weight logged (30), but neither in range, no workouts.
    expect(result.score).toBe(30);
    expect(result.contributions.find((c) => c.key === "bp_in_range")?.earned).toBe(0);
    expect(result.contributions.find((c) => c.key === "glucose_in_range")?.earned).toBe(0);
  });

  it("ignores entries and workouts from other days", () => {
    const metrics = [metric({ id: "old", date: "2026-06-01", weightLbs: 220 })];
    const result = computeDailyAlignment({ today, metrics, workouts: [], goals });
    expect(result.score).toBe(0);
  });
});
