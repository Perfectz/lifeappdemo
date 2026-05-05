import { describe, expect, it } from "vitest";

import type { Task } from "@/domain";
import { getDashboardStats } from "@/domain/dashboard";
import { isIsoTimestampOnDate, toLocalIsoDate } from "@/domain/dates";

const today = "2026-05-04";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Dashboard task",
    status: "todo",
    priority: "medium",
    tags: [],
    createdAt: `${today}T09:00:00.000Z`,
    updatedAt: `${today}T09:00:00.000Z`,
    ...overrides
  };
}

describe("dashboard date helpers", () => {
  it("formats a local ISO date", () => {
    expect(toLocalIsoDate(new Date(2026, 4, 4, 9, 30))).toBe("2026-05-04");
  });

  it("detects whether an ISO timestamp is on a date", () => {
    expect(isIsoTimestampOnDate("2026-05-04T23:59:59.000Z", today)).toBe(true);
    expect(isIsoTimestampOnDate("2026-05-05T00:00:00.000Z", today)).toBe(true);
    expect(isIsoTimestampOnDate("2026-05-05T08:00:00.000Z", today)).toBe(false);
    expect(isIsoTimestampOnDate(undefined, today)).toBe(false);
  });
});

describe("dashboard stats", () => {
  it("derives planned tasks, backlog count, and completed-today count", () => {
    const stats = getDashboardStats(
      [
        makeTask({ id: "planned", plannedForDate: today }),
        makeTask({ id: "backlog" }),
        makeTask({ id: "tomorrow", plannedForDate: "2026-05-05" }),
        makeTask({
          id: "completed-today",
          status: "done",
          completedAt: "2026-05-04T18:00:00.000Z"
        }),
        makeTask({
          id: "completed-yesterday",
          status: "done",
          completedAt: "2026-05-03T18:00:00.000Z"
        }),
        makeTask({ id: "archived", status: "archived" })
      ],
      today
    );

    expect(stats.plannedTodayTasks.map((task) => task.id)).toEqual(["planned"]);
    expect(stats.activeBacklogCount).toBe(2);
    expect(stats.completedTodayCount).toBe(1);
  });
});
