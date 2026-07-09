import { describe, expect, it } from "vitest";

import type { Task } from "@/domain";
import {
  bucketForTask,
  compareActiveTasks,
  emptyTaskFilters,
  filterTasks,
  groupActiveTasks,
  hasActiveFilters
} from "@/domain/taskViews";

const now = "2026-07-01T12:00:00.000Z";
const today = "2026-07-08";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? `task-${Math.random()}`,
    title: "Quest",
    status: "todo",
    priority: "medium",
    tags: [],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("active view buckets", () => {
  it("puts past-due quests in overdue", () => {
    expect(bucketForTask(makeTask({ dueDate: "2026-07-07" }), today)).toBe("overdue");
  });

  it("puts quests due or planned today in today", () => {
    expect(bucketForTask(makeTask({ dueDate: today }), today)).toBe("today");
    expect(bucketForTask(makeTask({ plannedForDate: today }), today)).toBe("today");
  });

  it("keeps a carried-over plan (planned in the past, no due date) in today", () => {
    expect(bucketForTask(makeTask({ plannedForDate: "2026-07-05" }), today)).toBe("today");
  });

  it("puts future-dated quests in upcoming", () => {
    expect(bucketForTask(makeTask({ dueDate: "2026-07-20" }), today)).toBe("upcoming");
    expect(bucketForTask(makeTask({ plannedForDate: "2026-07-20" }), today)).toBe("upcoming");
  });

  it("puts dateless quests in someday", () => {
    expect(bucketForTask(makeTask(), today)).toBe("someday");
  });

  it("overdue wins over a today plan", () => {
    expect(
      bucketForTask(makeTask({ dueDate: "2026-07-01", plannedForDate: today }), today)
    ).toBe("overdue");
  });

  it("groups a mixed list into all four buckets", () => {
    const buckets = groupActiveTasks(
      [
        makeTask({ id: "late", dueDate: "2026-07-02" }),
        makeTask({ id: "now", dueDate: today }),
        makeTask({ id: "soon", dueDate: "2026-08-01" }),
        makeTask({ id: "later" })
      ],
      today
    );

    expect(buckets.overdue.map((t) => t.id)).toEqual(["late"]);
    expect(buckets.today.map((t) => t.id)).toEqual(["now"]);
    expect(buckets.upcoming.map((t) => t.id)).toEqual(["soon"]);
    expect(buckets.someday.map((t) => t.id)).toEqual(["later"]);
  });
});

describe("active view sorting", () => {
  it("sorts by priority high to low, then earliest due date", () => {
    const buckets = groupActiveTasks(
      [
        makeTask({ id: "low-early", priority: "low", dueDate: "2026-07-10" }),
        makeTask({ id: "high-late", priority: "high", dueDate: "2026-07-30" }),
        makeTask({ id: "high-early", priority: "high", dueDate: "2026-07-10" }),
        makeTask({ id: "medium", priority: "medium", dueDate: "2026-07-09" })
      ],
      today
    );

    expect(buckets.upcoming.map((t) => t.id)).toEqual([
      "high-early",
      "high-late",
      "medium",
      "low-early"
    ]);
  });

  it("sorts undated quests after dated ones at equal priority", () => {
    const dated = makeTask({ id: "dated", plannedForDate: "2026-08-01" });
    const undatedButUpcomingDue = makeTask({ id: "due", dueDate: "2026-08-02" });

    expect(compareActiveTasks(undatedButUpcomingDue, dated)).toBeLessThan(0);
  });

  it("falls back to creation time as the final tiebreak", () => {
    const older = makeTask({ id: "older", createdAt: "2026-07-01T08:00:00.000Z" });
    const newer = makeTask({ id: "newer", createdAt: "2026-07-02T08:00:00.000Z" });

    expect(compareActiveTasks(older, newer)).toBeLessThan(0);
    expect(compareActiveTasks(newer, older)).toBeGreaterThan(0);
  });
});

describe("search + filter", () => {
  const tasks = [
    makeTask({ id: "ship", title: "Ship the report", description: "Quarterly", tags: ["work"], priority: "high" }),
    makeTask({ id: "walk", title: "Walk 10k steps", tags: ["health"], priority: "medium" }),
    makeTask({ id: "read", title: "Read a chapter", description: "Deep work book", tags: ["learning"], priority: "low" })
  ];

  it("reports whether any filter is active", () => {
    expect(hasActiveFilters(emptyTaskFilters)).toBe(false);
    expect(hasActiveFilters({ ...emptyTaskFilters, search: "  " })).toBe(false);
    expect(hasActiveFilters({ ...emptyTaskFilters, search: "x" })).toBe(true);
    expect(hasActiveFilters({ ...emptyTaskFilters, tags: ["work"] })).toBe(true);
    expect(hasActiveFilters({ ...emptyTaskFilters, priorities: ["low"] })).toBe(true);
  });

  it("returns the same list when no filters are active", () => {
    expect(filterTasks(tasks, emptyTaskFilters)).toBe(tasks);
  });

  it("matches title and description substrings case-insensitively", () => {
    expect(filterTasks(tasks, { ...emptyTaskFilters, search: "SHIP" }).map((t) => t.id)).toEqual([
      "ship"
    ]);
    expect(
      filterTasks(tasks, { ...emptyTaskFilters, search: "deep work" }).map((t) => t.id)
    ).toEqual(["read"]);
  });

  it("filters by tag and priority chips", () => {
    expect(filterTasks(tasks, { ...emptyTaskFilters, tags: ["health"] }).map((t) => t.id)).toEqual(
      ["walk"]
    );
    expect(
      filterTasks(tasks, { ...emptyTaskFilters, priorities: ["high", "low"] }).map((t) => t.id)
    ).toEqual(["ship", "read"]);
  });

  it("combines search, tags, and priority with AND semantics", () => {
    expect(
      filterTasks(tasks, { search: "report", tags: ["work"], priorities: ["high"] }).map(
        (t) => t.id
      )
    ).toEqual(["ship"]);
    expect(
      filterTasks(tasks, { search: "report", tags: ["health"], priorities: ["high"] })
    ).toEqual([]);
  });
});
