import { describe, expect, it } from "vitest";

import type { Task } from "@/domain";
import { getDashboardStats } from "@/domain/dashboard";
import { isIsoTimestampOnDate, toLocalIsoDate } from "@/domain/dates";

const today = "2026-05-04";

function localIsoTimestamp(year: number, monthIndex: number, day: number, hour: number): string {
  return new Date(year, monthIndex, day, hour).toISOString();
}

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
    expect(isIsoTimestampOnDate(localIsoTimestamp(2026, 4, 4, 23), today)).toBe(true);
    expect(isIsoTimestampOnDate(localIsoTimestamp(2026, 4, 5, 8), today)).toBe(false);
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
          completedAt: localIsoTimestamp(2026, 4, 4, 18)
        }),
        makeTask({
          id: "completed-yesterday",
          status: "done",
          completedAt: localIsoTimestamp(2026, 4, 3, 18)
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
