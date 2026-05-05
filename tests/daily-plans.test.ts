import { describe, expect, it } from "vitest";

import type { DailyPlan, Task } from "@/domain";
import {
  getActiveDailyPlanForDate,
  isDailyPlan,
  upsertDailyPlanForDate,
  validateDailyPlanInput
} from "@/domain/dailyPlans";

const today = "2026-05-04";
const now = "2026-05-04T09:00:00.000Z";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Plan the day",
    status: "todo",
    priority: "medium",
    tags: [],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function makePlan(overrides: Partial<DailyPlan> = {}): DailyPlan {
  return {
    id: "plan-1",
    date: today,
    mainQuestTaskId: "task-1",
    sideQuestTaskIds: [],
    intention: "Stay focused.",
    status: "planned",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("DailyPlan validation", () => {
  it("accepts a valid active Main Quest and Side Quests", () => {
    const validation = validateDailyPlanInput(
      {
        date: today,
        mainQuestTaskId: "main",
        sideQuestTaskIds: ["side-1", "side-2"],
        intention: " Ship V03. "
      },
      [
        makeTask({ id: "main" }),
        makeTask({ id: "side-1" }),
        makeTask({ id: "side-2" })
      ]
    );

    expect(validation).toEqual({
      ok: true,
      value: {
        date: today,
        mainQuestTaskId: "main",
        sideQuestTaskIds: ["side-1", "side-2"],
        intention: "Ship V03."
      }
    });
  });

  it("blocks overlap between Main Quest and Side Quests", () => {
    const validation = validateDailyPlanInput(
      {
        date: today,
        mainQuestTaskId: "task-1",
        sideQuestTaskIds: ["task-1"]
      },
      [makeTask()]
    );

    expect(validation).toEqual({
      ok: false,
      message: "Main Quest cannot also be a Side Quest."
    });
  });

  it("enforces the Side Quest maximum", () => {
    const validation = validateDailyPlanInput(
      {
        date: today,
        mainQuestTaskId: "main",
        sideQuestTaskIds: ["side-1", "side-2", "side-3", "side-4"]
      },
      [
        makeTask({ id: "main" }),
        makeTask({ id: "side-1" }),
        makeTask({ id: "side-2" }),
        makeTask({ id: "side-3" }),
        makeTask({ id: "side-4" })
      ]
    );

    expect(validation).toEqual({
      ok: false,
      message: "Choose up to three Side Quests."
    });
  });

  it("rejects archived task references", () => {
    const validation = validateDailyPlanInput(
      {
        date: today,
        mainQuestTaskId: "task-1",
        sideQuestTaskIds: []
      },
      [makeTask({ status: "archived" })]
    );

    expect(validation).toEqual({
      ok: false,
      message: "Main Quest must be an active quest."
    });
  });
});

describe("DailyPlan upsert", () => {
  it("creates one planned entry per date and edits it on the next save", () => {
    const tasks = [makeTask({ id: "task-1" }), makeTask({ id: "task-2" })];
    const created = upsertDailyPlanForDate(
      [],
      {
        date: today,
        mainQuestTaskId: "task-1",
        sideQuestTaskIds: []
      },
      tasks,
      now
    );

    const updated = upsertDailyPlanForDate(
      created,
      {
        date: today,
        mainQuestTaskId: "task-2",
        sideQuestTaskIds: [],
        intention: "Change direction."
      },
      tasks,
      "2026-05-04T10:00:00.000Z"
    );

    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({
      id: created[0].id,
      mainQuestTaskId: "task-2",
      intention: "Change direction.",
      createdAt: now,
      updatedAt: "2026-05-04T10:00:00.000Z"
    });
  });

  it("finds active plans by date and validates stored shape", () => {
    const plan = makePlan();

    expect(getActiveDailyPlanForDate([plan], today)).toEqual(plan);
    expect(getActiveDailyPlanForDate([makePlan({ status: "closed" })], today)).toBeUndefined();
    expect(isDailyPlan(plan)).toBe(true);
    expect(isDailyPlan({ ...plan, status: "draft" })).toBe(false);
  });
});
