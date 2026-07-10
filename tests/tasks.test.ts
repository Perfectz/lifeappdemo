import { describe, expect, it } from "vitest";

import type { Task } from "@/domain";
import {
  archiveTask,
  checklistProgress,
  completeTask,
  completeTaskWithRecurrence,
  createTask,
  groupTasks,
  isTask,
  nextOccurrenceAfter,
  nextOccurrenceDate,
  reopenTask,
  taskToInput,
  taskXp,
  toggleChecklistItem,
  updateTask,
  validateTaskInput,
  xpForDifficulty
} from "@/domain/tasks";

const now = "2026-05-03T20:00:00.000Z";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Ship V01",
    status: "todo",
    priority: "medium",
    tags: ["work"],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("task domain", () => {
  it("accepts valid task input and creates a todo task", () => {
    const task = createTask(
      {
        title: "  Clear inbox  ",
        description: "Admin sweep",
        priority: "low",
        tags: ["admin"],
        dueDate: "2026-05-04",
        plannedForDate: "2026-05-03",
        linkedGoalId: "goal-1"
      },
      now
    );

    expect(task).toMatchObject({
      title: "Clear inbox",
      description: "Admin sweep",
      status: "todo",
      priority: "low",
      tags: ["admin"],
      dueDate: "2026-05-04",
      plannedForDate: "2026-05-03",
      linkedGoalId: "goal-1",
      createdAt: now,
      updatedAt: now
    });
  });

  it("rejects empty titles", () => {
    expect(
      validateTaskInput({
        title: "   ",
        priority: "medium",
        tags: []
      })
    ).toEqual({
      ok: false,
      message: "Quest title is required."
    });
  });

  it("completes a task with a completedAt timestamp", () => {
    expect(completeTask(makeTask(), now)).toMatchObject({
      status: "done",
      completedAt: now,
      updatedAt: now
    });
  });

  it("reopens a task and clears completedAt", () => {
    const reopened = reopenTask(
      makeTask({
        status: "done",
        completedAt: now
      }),
      "2026-05-04T10:00:00.000Z"
    );

    expect(reopened.status).toBe("todo");
    expect(reopened.completedAt).toBeUndefined();
  });

  it("archives a task with an archivedAt timestamp", () => {
    expect(archiveTask(makeTask(), now)).toMatchObject({
      status: "archived",
      archivedAt: now,
      updatedAt: now
    });
  });

  it("groups tasks by status", () => {
    const groups = groupTasks([
      makeTask({ id: "active", status: "todo" }),
      makeTask({ id: "done", status: "done" }),
      makeTask({ id: "archived", status: "archived" })
    ]);

    expect(groups.active.map((task) => task.id)).toEqual(["active"]);
    expect(groups.completed.map((task) => task.id)).toEqual(["done"]);
    expect(groups.archived.map((task) => task.id)).toEqual(["archived"]);
  });

  it("carries recurrence and checklist through createTask, dropping blank lines", () => {
    const task = createTask(
      {
        title: "Morning mobility",
        priority: "medium",
        tags: ["health"],
        recurrence: { frequency: "daily" },
        checklist: [
          { id: "c1", text: "  Neck rolls  ", done: false },
          { id: "c2", text: "   ", done: false }
        ]
      },
      now
    );

    expect(task.recurrence).toEqual({ frequency: "daily" });
    expect(task.checklist).toEqual([{ id: "c1", text: "Neck rolls", done: false }]);
  });

  it("normalizes an empty checklist to undefined", () => {
    const task = createTask(
      { title: "Plain quest", priority: "low", tags: [], checklist: [] },
      now
    );

    expect(task.checklist).toBeUndefined();
  });

  it("updateTask preserves recurrence/checklist when the input omits the keys", () => {
    const task = makeTask({
      recurrence: { frequency: "weekly" },
      checklist: [{ id: "c1", text: "Step", done: true }]
    });

    const updated = updateTask(
      task,
      { title: "Renamed", priority: "high", tags: ["work"] },
      now
    );

    expect(updated.recurrence).toEqual({ frequency: "weekly" });
    expect(updated.checklist).toEqual([{ id: "c1", text: "Step", done: true }]);
  });

  it("updateTask clears recurrence/checklist when the keys are present but empty", () => {
    const task = makeTask({
      recurrence: { frequency: "weekly" },
      checklist: [{ id: "c1", text: "Step", done: true }]
    });

    const updated = updateTask(
      task,
      { title: "Renamed", priority: "high", tags: [], recurrence: undefined, checklist: [] },
      now
    );

    expect(updated.recurrence).toBeUndefined();
    expect(updated.checklist).toBeUndefined();
  });

  it("maps a stored task back into input shape", () => {
    const task = makeTask({
      description: "Notes",
      dueDate: "2026-05-10",
      recurrence: { frequency: "monthly" },
      checklist: [{ id: "c1", text: "Step", done: false }]
    });

    expect(taskToInput(task)).toEqual({
      title: task.title,
      description: "Notes",
      priority: "medium",
      tags: ["work"],
      dueDate: "2026-05-10",
      plannedForDate: undefined,
      recurrence: { frequency: "monthly" },
      checklist: [{ id: "c1", text: "Step", done: false }]
    });
  });
});

describe("task difficulty", () => {
  it("awards 1/1/2/4 XP per tier and treats absence as standard", () => {
    expect(xpForDifficulty).toEqual({ quick: 1, standard: 1, hard: 2, epic: 4 });
    expect(taskXp(makeTask())).toBe(1);
    expect(taskXp(makeTask({ difficulty: "quick" }))).toBe(1);
    expect(taskXp(makeTask({ difficulty: "standard" }))).toBe(1);
    expect(taskXp(makeTask({ difficulty: "hard" }))).toBe(2);
    expect(taskXp(makeTask({ difficulty: "epic" }))).toBe(4);
  });

  it("carries difficulty through createTask and normalizes standard to absence", () => {
    const epic = createTask(
      { title: "Slay the deadline", priority: "high", tags: [], difficulty: "epic" },
      now
    );
    const standard = createTask(
      { title: "Plain quest", priority: "low", tags: [], difficulty: "standard" },
      now
    );

    expect(epic.difficulty).toBe("epic");
    expect(standard.difficulty).toBeUndefined();
  });

  it("updateTask preserves difficulty when the input omits the key", () => {
    const task = makeTask({ difficulty: "epic" });

    const updated = updateTask(task, { title: "Renamed", priority: "high", tags: [] }, now);

    expect(updated.difficulty).toBe("epic");
  });

  it("updateTask sets and clears difficulty when the key is present", () => {
    const task = makeTask({ difficulty: "hard" });

    const promoted = updateTask(
      task,
      { title: task.title, priority: task.priority, tags: task.tags, difficulty: "epic" },
      now
    );
    const reset = updateTask(
      task,
      { title: task.title, priority: task.priority, tags: task.tags, difficulty: "standard" },
      now
    );

    expect(promoted.difficulty).toBe("epic");
    expect(reset.difficulty).toBeUndefined();
  });

  it("taskToInput carries difficulty for the edit form", () => {
    expect(taskToInput(makeTask({ difficulty: "hard" })).difficulty).toBe("hard");
  });

  it("completing a recurring quest carries difficulty to the next occurrence", () => {
    const { next } = completeTaskWithRecurrence(
      makeTask({ difficulty: "epic", recurrence: { frequency: "daily" }, dueDate: "2026-05-03" }),
      now,
      "2026-05-03"
    );

    expect(next?.difficulty).toBe("epic");
  });

  it("isTask accepts absent or valid difficulty and rejects malformed values", () => {
    expect(isTask(makeTask())).toBe(true);
    expect(isTask(makeTask({ difficulty: "epic" }))).toBe(true);
    expect(isTask(makeTask({ difficulty: "legendary" as never }))).toBe(false);
    expect(isTask(makeTask({ difficulty: 4 as never }))).toBe(false);
  });
});

describe("nextOccurrenceDate", () => {
  it("daily advances one calendar day", () => {
    expect(nextOccurrenceDate("2026-07-08", "daily")).toBe("2026-07-09");
  });

  it("daily rolls across month and year boundaries", () => {
    expect(nextOccurrenceDate("2026-07-31", "daily")).toBe("2026-08-01");
    expect(nextOccurrenceDate("2026-12-31", "daily")).toBe("2027-01-01");
  });

  it("weekdays skips the weekend: Friday goes to Monday", () => {
    // 2026-07-10 is a Friday; 2026-07-13 the following Monday.
    expect(nextOccurrenceDate("2026-07-10", "weekdays")).toBe("2026-07-13");
  });

  it("weekdays from Saturday and Sunday also lands on Monday", () => {
    expect(nextOccurrenceDate("2026-07-11", "weekdays")).toBe("2026-07-13");
    expect(nextOccurrenceDate("2026-07-12", "weekdays")).toBe("2026-07-13");
  });

  it("weekdays midweek advances a single day", () => {
    // Wednesday -> Thursday
    expect(nextOccurrenceDate("2026-07-08", "weekdays")).toBe("2026-07-09");
  });

  it("weekly repeats on the same weekday seven days later", () => {
    expect(nextOccurrenceDate("2026-07-08", "weekly")).toBe("2026-07-15");
    expect(nextOccurrenceDate("2026-12-29", "weekly")).toBe("2027-01-05");
  });

  it("monthly keeps the day-of-month", () => {
    expect(nextOccurrenceDate("2026-07-15", "monthly")).toBe("2026-08-15");
  });

  it("monthly clamps Jan 31 to Feb 28 in a common year", () => {
    expect(nextOccurrenceDate("2026-01-31", "monthly")).toBe("2026-02-28");
  });

  it("monthly clamps Jan 31 to Feb 29 in a leap year", () => {
    expect(nextOccurrenceDate("2028-01-31", "monthly")).toBe("2028-02-29");
  });

  it("monthly clamps Mar 31 to Apr 30", () => {
    expect(nextOccurrenceDate("2026-03-31", "monthly")).toBe("2026-04-30");
  });

  it("monthly rolls Dec into January of the next year", () => {
    expect(nextOccurrenceDate("2026-12-31", "monthly")).toBe("2027-01-31");
  });
});

describe("nextOccurrenceAfter", () => {
  it("catches an overdue weekly date up past today on the same weekday", () => {
    // 2026-06-10 was a Wednesday; today (2026-07-08) is also a Wednesday,
    // so the next Wednesday strictly after today is 2026-07-15.
    expect(nextOccurrenceAfter("2026-06-10", "weekly", "2026-07-08")).toBe("2026-07-15");
  });

  it("catches an overdue monthly date up past today", () => {
    expect(nextOccurrenceAfter("2026-03-15", "monthly", "2026-07-08")).toBe("2026-07-15");
  });

  it("returns the plain next occurrence when the date is current", () => {
    expect(nextOccurrenceAfter("2026-07-08", "daily", "2026-07-08")).toBe("2026-07-09");
  });
});

describe("completeTaskWithRecurrence", () => {
  const today = "2026-07-08";

  it("does not spawn a next occurrence for non-recurring tasks", () => {
    const result = completeTaskWithRecurrence(makeTask(), now, today);

    expect(result.next).toBeUndefined();
    expect(result.completed).toEqual(completeTask(makeTask(), now));
  });

  it("spawns a fresh todo with fields carried over and dates advanced", () => {
    const task = makeTask({
      description: "Stretch and breathe",
      priority: "high",
      tags: ["health"],
      dueDate: today,
      plannedForDate: today,
      recurrence: { frequency: "daily" },
      checklist: [
        { id: "c1", text: "Warm up", done: true },
        { id: "c2", text: "Cool down", done: false }
      ]
    });

    const { completed, next } = completeTaskWithRecurrence(task, now, today);

    expect(completed.status).toBe("done");
    expect(completed.completedAt).toBe(now);

    expect(next).toBeDefined();
    expect(next?.id).not.toBe(task.id);
    expect(next).toMatchObject({
      title: task.title,
      description: "Stretch and breathe",
      status: "todo",
      priority: "high",
      tags: ["health"],
      dueDate: "2026-07-09",
      plannedForDate: "2026-07-09",
      recurrence: { frequency: "daily" },
      createdAt: now,
      updatedAt: now
    });
    expect(next?.completedAt).toBeUndefined();
    expect(next?.archivedAt).toBeUndefined();
  });

  it("resets the spawned checklist to not-done with fresh item ids", () => {
    const task = makeTask({
      recurrence: { frequency: "daily" },
      dueDate: today,
      checklist: [{ id: "c1", text: "Warm up", done: true }]
    });

    const { next } = completeTaskWithRecurrence(task, now, today);

    expect(next?.checklist).toHaveLength(1);
    expect(next?.checklist?.[0]).toMatchObject({ text: "Warm up", done: false });
    expect(next?.checklist?.[0].id).not.toBe("c1");
  });

  it("advances an overdue weekly quest past today on its original weekday", () => {
    const task = makeTask({
      // A Wednesday several weeks before "today" (also a Wednesday).
      dueDate: "2026-06-10",
      recurrence: { frequency: "weekly" }
    });

    const { next } = completeTaskWithRecurrence(task, now, today);

    expect(next?.dueDate).toBe("2026-07-15");
  });

  it("spawns a dateless next occurrence for recurring tasks without dates", () => {
    const task = makeTask({ recurrence: { frequency: "daily" } });

    const { next } = completeTaskWithRecurrence(task, now, today);

    expect(next).toBeDefined();
    expect(next?.dueDate).toBeUndefined();
    expect(next?.plannedForDate).toBeUndefined();
  });
});

describe("checklist helpers", () => {
  it("toggles an item and stamps updatedAt", () => {
    const task = makeTask({
      checklist: [
        { id: "c1", text: "One", done: false },
        { id: "c2", text: "Two", done: true }
      ]
    });

    const later = "2026-05-04T09:00:00.000Z";
    const toggled = toggleChecklistItem(task, "c1", later);

    expect(toggled.checklist).toEqual([
      { id: "c1", text: "One", done: true },
      { id: "c2", text: "Two", done: true }
    ]);
    expect(toggled.updatedAt).toBe(later);
  });

  it("is a no-op for unknown item ids", () => {
    const task = makeTask({ checklist: [{ id: "c1", text: "One", done: false }] });

    expect(toggleChecklistItem(task, "missing", now)).toBe(task);
  });

  it("reports progress including tasks without a checklist", () => {
    expect(checklistProgress(makeTask())).toEqual({ done: 0, total: 0 });
    expect(
      checklistProgress(
        makeTask({
          checklist: [
            { id: "c1", text: "One", done: true },
            { id: "c2", text: "Two", done: false }
          ]
        })
      )
    ).toEqual({ done: 1, total: 2 });
  });
});

describe("isTask storage guard", () => {
  it("accepts tasks stored before recurrence/checklist existed", () => {
    const legacy = {
      id: "task-1",
      title: "Old quest",
      status: "todo",
      priority: "medium",
      tags: ["work"],
      createdAt: now,
      updatedAt: now
    };

    expect(isTask(legacy)).toBe(true);
  });

  it("accepts tasks with valid recurrence and checklist", () => {
    expect(
      isTask(
        makeTask({
          recurrence: { frequency: "weekdays" },
          checklist: [{ id: "c1", text: "One", done: false }]
        })
      )
    ).toBe(true);
  });

  it("rejects malformed recurrence", () => {
    expect(isTask(makeTask({ recurrence: { frequency: "yearly" } as never }))).toBe(false);
    expect(isTask(makeTask({ recurrence: "daily" as never }))).toBe(false);
  });

  it("rejects malformed checklist entries", () => {
    expect(isTask(makeTask({ checklist: [{ id: "c1", text: 3, done: false }] as never }))).toBe(
      false
    );
    expect(isTask(makeTask({ checklist: "not-a-list" as never }))).toBe(false);
  });
});
