import { describe, expect, it } from "vitest";

import type { DailyPlan, EveningPostmortem, Task } from "@/domain";
import {
  applyTaskOutcomes,
  closePlanAfterPostmortem,
  getEveningPostmortemForDate,
  isEveningPostmortem,
  upsertEveningPostmortemForDate,
  validateEveningPostmortemInput
} from "@/domain/eveningPostmortems";

const today = "2026-05-04";
const now = "2026-05-04T20:00:00.000Z";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Close the day",
    status: "todo",
    priority: "medium",
    tags: [],
    plannedForDate: today,
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
    status: "planned",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function makePostmortem(overrides: Partial<EveningPostmortem> = {}): EveningPostmortem {
  return {
    id: "postmortem-1",
    date: today,
    dailyPlanId: "plan-1",
    taskOutcomes: [{ taskId: "task-1", outcome: "completed" }],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("EveningPostmortem validation", () => {
  it("normalizes a valid postmortem input", () => {
    const validation = validateEveningPostmortemInput({
      date: today,
      dailyPlanId: "plan-1",
      taskOutcomes: [{ taskId: "task-1", outcome: "completed", note: " Done. " }],
      wins: " Won the day. "
    });

    expect(validation).toEqual({
      ok: true,
      value: {
        date: today,
        dailyPlanId: "plan-1",
        taskOutcomes: [{ taskId: "task-1", outcome: "completed", note: "Done." }],
        wins: "Won the day.",
        friction: undefined,
        lessonsLearned: undefined,
        tomorrowFollowUps: undefined
      }
    });
  });

  it("rejects invalid task outcomes", () => {
    const validation = validateEveningPostmortemInput({
      date: today,
      taskOutcomes: [{ taskId: "task-1", outcome: "invalid" as "completed" }]
    });

    expect(validation).toEqual({ ok: false, message: "Task outcome is invalid." });
  });
});

describe("task outcome reducer", () => {
  it("marks completed tasks done with completedAt", () => {
    const [task] = applyTaskOutcomes(
      [makeTask()],
      [{ taskId: "task-1", outcome: "completed" }],
      now
    );

    expect(task).toMatchObject({
      status: "done",
      completedAt: now,
      updatedAt: now
    });
  });

  it("keeps deferred tasks active and clears planned date", () => {
    const [task] = applyTaskOutcomes(
      [makeTask()],
      [{ taskId: "task-1", outcome: "deferred" }],
      now
    );

    expect(task.status).toBe("todo");
    expect(task.completedAt).toBeUndefined();
    expect(task.plannedForDate).toBeUndefined();
  });

  it("keeps left-open tasks active", () => {
    const [task] = applyTaskOutcomes(
      [makeTask()],
      [{ taskId: "task-1", outcome: "left_open" }],
      now
    );

    expect(task.status).toBe("todo");
    expect(task.plannedForDate).toBe(today);
  });
});

describe("postmortem upsert and plan closing", () => {
  it("upserts one postmortem per date", () => {
    const created = upsertEveningPostmortemForDate(
      [],
      { date: today, taskOutcomes: [], wins: "First" },
      now
    );
    const updated = upsertEveningPostmortemForDate(
      created,
      { date: today, taskOutcomes: [], wins: "Edited" },
      "2026-05-04T21:00:00.000Z"
    );

    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({
      id: created[0].id,
      wins: "Edited",
      createdAt: now,
      updatedAt: "2026-05-04T21:00:00.000Z"
    });
  });

  it("closes a planned DailyPlan", () => {
    const [plan] = closePlanAfterPostmortem([makePlan()], "plan-1", now);

    expect(plan.status).toBe("closed");
    expect(plan.updatedAt).toBe(now);
  });

  it("finds and validates stored postmortems", () => {
    const postmortem = makePostmortem();

    expect(getEveningPostmortemForDate([postmortem], today)).toEqual(postmortem);
    expect(isEveningPostmortem(postmortem)).toBe(true);
    expect(isEveningPostmortem({ ...postmortem, taskOutcomes: [{ outcome: "bad" }] })).toBe(false);
  });
});
