import { describe, expect, it } from "vitest";

import type { Task } from "@/domain";
import {
  archiveTask,
  completeTask,
  createTask,
  groupTasks,
  reopenTask,
  validateTaskInput
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
        plannedForDate: "2026-05-03"
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
});
