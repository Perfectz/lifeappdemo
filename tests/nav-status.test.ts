import { describe, expect, it } from "vitest";

import type { DailyPlan, Task } from "@/domain";
import { getNavStatusMap } from "@/domain/navStatus";

const today = "2026-05-04";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t",
    title: "Quest",
    status: "todo",
    priority: "medium",
    tags: [],
    createdAt: `${today}T09:00:00.000Z`,
    updatedAt: `${today}T09:00:00.000Z`,
    ...overrides
  };
}

function makePlan(date: string): DailyPlan {
  return {
    id: `plan-${date}`,
    date,
    sideQuestTaskIds: [],
    status: "planned",
    createdAt: `${date}T08:00:00.000Z`,
    updatedAt: `${date}T08:00:00.000Z`
  };
}

describe("getNavStatusMap", () => {
  it("pulses Morning before noon when no plan exists for today", () => {
    const map = getNavStatusMap({
      tasks: [],
      plans: [],
      today,
      hour: 9
    });
    expect(map["/standup/morning"]?.pulse).toBe(true);
  });

  it("does not pulse Morning once today's plan exists", () => {
    const map = getNavStatusMap({
      tasks: [],
      plans: [makePlan(today)],
      today,
      hour: 9
    });
    expect(map["/standup/morning"]).toBeUndefined();
  });

  it("does not pulse Morning after noon", () => {
    const map = getNavStatusMap({
      tasks: [],
      plans: [],
      today,
      hour: 14
    });
    expect(map["/standup/morning"]).toBeUndefined();
  });

  it("shows overdue count on Quest Log when todo tasks are past their plannedForDate", () => {
    const map = getNavStatusMap({
      tasks: [
        makeTask({ id: "a", plannedForDate: "2026-05-02" }),
        makeTask({ id: "b", plannedForDate: "2026-05-03" }),
        makeTask({ id: "c", plannedForDate: today }),
        makeTask({ id: "d", plannedForDate: "2026-05-02", status: "done" })
      ],
      plans: [],
      today,
      hour: 10
    });
    expect(map["/tasks"]).toEqual({
      badge: 2,
      pulse: true,
      hint: "2 quests overdue"
    });
  });

  it("uses singular copy for a single overdue quest", () => {
    const map = getNavStatusMap({
      tasks: [makeTask({ plannedForDate: "2026-05-02" })],
      plans: [],
      today,
      hour: 10
    });
    expect(map["/tasks"]?.hint).toBe("1 quest overdue");
  });
});
