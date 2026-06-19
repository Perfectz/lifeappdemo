import { describe, expect, it } from "vitest";

import { computeCharacterStats } from "@/domain/characterStats";
import { defaultHealthGoals } from "@/domain/healthGoals";
import type { MetricEntry, Workout } from "@/domain";

const today = "2026-06-19";
const goals = defaultHealthGoals();

function workout(type: Workout["type"], date: string, id: string): Workout {
  return {
    id,
    date,
    type,
    title: type,
    durationMinutes: 30,
    recordedAt: `${date}T10:00:00.000Z`,
    createdAt: `${date}T10:00:00.000Z`,
    updatedAt: `${date}T10:00:00.000Z`
  } as Workout;
}

function metric(date: string, overrides: Partial<MetricEntry>): MetricEntry {
  return {
    id: `m-${date}-${overrides.id ?? "x"}`,
    date,
    checkInType: "morning",
    source: "manual",
    recordedAt: `${date}T08:00:00.000Z`,
    createdAt: `${date}T08:00:00.000Z`,
    updatedAt: `${date}T08:00:00.000Z`,
    ...overrides
  };
}

describe("character stats", () => {
  it("is all zero with no data", () => {
    const result = computeCharacterStats({ today, metrics: [], workouts: [], goals });
    expect(result.overall).toBe(0);
    expect(result.stats.every((s) => s.value === 0)).toBe(true);
    expect(result.stats.map((s) => s.key)).toEqual(["str", "end", "technique", "vitality", "discipline"]);
  });

  it("raises STR with strength sessions in the window", () => {
    const workouts = Array.from({ length: 8 }, (_, i) => workout("strength", today, `s${i}`));
    const result = computeCharacterStats({ today, metrics: [], workouts, goals });
    const str = result.stats.find((s) => s.key === "str");
    expect(str?.value).toBeGreaterThan(0);
  });

  it("rewards in-range vitals for VITALITY and ignores out-of-window data", () => {
    const metrics = [
      metric(today, { id: "a", bloodPressureSystolic: 120, bloodPressureDiastolic: 78 }),
      metric(today, { id: "b", bloodGlucoseMgDl: 90, glucoseContext: "fasting" }),
      metric("2026-01-01", { id: "old", bloodPressureSystolic: 200, bloodPressureDiastolic: 120 })
    ];
    const result = computeCharacterStats({ today, metrics, workouts: [], goals });
    const vit = result.stats.find((s) => s.key === "vitality");
    expect(vit?.value).toBe(99); // both recent readings in range
  });

  it("caps stats at 99", () => {
    const workouts = Array.from({ length: 40 }, (_, i) => workout("cardio", today, `c${i}`));
    const result = computeCharacterStats({ today, metrics: [], workouts, goals });
    expect(result.stats.find((s) => s.key === "end")?.value).toBe(99);
  });
});
