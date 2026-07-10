import { describe, expect, it } from "vitest";

import {
  createGoal,
  effectiveGoalProgressFraction,
  goalProgressFraction,
  isGoal,
  validateGoalInput
} from "@/domain/goals";
import { completeTask, createTask } from "@/domain/tasks";

const now = "2026-06-15T08:00:00.000Z";

describe("goals domain", () => {
  it("creates an active goal with timestamps", () => {
    const goal = createGoal(
      { pillar: "fitness", horizon: "quarterly", title: "  Bench 30 lb DBs  " },
      now
    );
    expect(goal).toMatchObject({
      pillar: "fitness",
      horizon: "quarterly",
      title: "Bench 30 lb DBs",
      status: "active",
      createdAt: now,
      updatedAt: now
    });
  });

  it("rejects empty title and invalid pillar/horizon", () => {
    expect(validateGoalInput({ pillar: "fitness", horizon: "weekly", title: "  " }).ok).toBe(false);
    expect(validateGoalInput({ pillar: "x" as never, horizon: "weekly", title: "t" }).ok).toBe(false);
    expect(validateGoalInput({ pillar: "fitness", horizon: "x" as never, title: "t" }).ok).toBe(false);
  });

  it("computes clamped progress and undefined when not measurable", () => {
    expect(goalProgressFraction(createGoal({ pillar: "personal", horizon: "yearly", title: "t", targetValue: 200, currentValue: 180 }, now))).toBeCloseTo(0.9);
    expect(goalProgressFraction(createGoal({ pillar: "personal", horizon: "yearly", title: "t", targetValue: 200, currentValue: 250 }, now))).toBe(1);
    expect(goalProgressFraction(createGoal({ pillar: "personal", horizon: "yearly", title: "t" }, now))).toBeUndefined();
  });

  it("guards goal shape", () => {
    expect(isGoal(createGoal({ pillar: "professional", horizon: "vision", title: "t" }, now))).toBe(true);
    expect(isGoal({ id: "x", title: "t" })).toBe(false);
  });

  it("derives progress from linked quests when there is no numeric metric", () => {
    const goal = createGoal({ pillar: "professional", horizon: "quarterly", title: "Launch" }, now);
    const open = createTask({ title: "Draft", priority: "medium", tags: ["work"], linkedGoalId: goal.id }, now);
    const done = completeTask(
      createTask({ title: "Research", priority: "medium", tags: ["work"], linkedGoalId: goal.id }, now),
      now
    );
    expect(effectiveGoalProgressFraction(goal, [open, done])).toBe(0.5);
  });
});
