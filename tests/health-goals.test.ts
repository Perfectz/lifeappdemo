import { describe, expect, it } from "vitest";

import {
  defaultHealthGoals,
  isHealthGoals,
  weightGoalProgressPercent,
  withGoalEdits
} from "@/domain/healthGoals";

describe("health goals", () => {
  it("provides standard clinical defaults (not personal data)", () => {
    const goals = defaultHealthGoals("2026-06-18T00:00:00.000Z");
    expect(goals.bpSystolicTarget).toBe(130);
    expect(goals.bpDiastolicTarget).toBe(80);
    expect(goals.dailyWorkoutsTarget).toBe(3);
    expect(goals.weightTargetLbs).toBeUndefined();
    expect(isHealthGoals(goals)).toBe(true);
  });

  it("rejects malformed goals", () => {
    expect(isHealthGoals(null)).toBe(false);
    expect(isHealthGoals({ bpSystolicTarget: "high" })).toBe(false);
    expect(isHealthGoals({ ...defaultHealthGoals(), bpSystolicTarget: -1 })).toBe(false);
  });

  it("merges edits and stamps updatedAt", () => {
    const base = defaultHealthGoals("2026-06-18T00:00:00.000Z");
    const next = withGoalEdits(base, { weightTargetLbs: 195 }, "2026-06-19T00:00:00.000Z");
    expect(next.weightTargetLbs).toBe(195);
    expect(next.updatedAt).toBe("2026-06-19T00:00:00.000Z");
    expect(next.bpSystolicTarget).toBe(130);
  });

  it("computes weight progress from start toward target", () => {
    const goals = withGoalEdits(defaultHealthGoals(), { weightStartLbs: 230, weightTargetLbs: 200 });
    expect(weightGoalProgressPercent(goals, 230)).toBe(0);
    expect(weightGoalProgressPercent(goals, 215)).toBe(50);
    expect(weightGoalProgressPercent(goals, 200)).toBe(100);
    expect(weightGoalProgressPercent(goals, 190)).toBe(100); // clamped
  });

  it("returns undefined progress without enough info", () => {
    const goals = defaultHealthGoals();
    expect(weightGoalProgressPercent(goals, 220)).toBeUndefined();
  });
});
