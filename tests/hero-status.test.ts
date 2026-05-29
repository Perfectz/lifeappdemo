import { describe, expect, it } from "vitest";

import type { MetricEntry, Task } from "@/domain";
import { computeStreak, formatHpMp, getHeroStatus } from "@/domain/heroStatus";

const today = "2026-05-04";

function localIso(year: number, monthIndex: number, day: number, hour = 12): string {
  return new Date(year, monthIndex, day, hour).toISOString();
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-x",
    title: "Quest",
    status: "todo",
    priority: "medium",
    tags: [],
    createdAt: `${today}T09:00:00.000Z`,
    updatedAt: `${today}T09:00:00.000Z`,
    ...overrides
  };
}

function makeMetric(overrides: Partial<MetricEntry> = {}): MetricEntry {
  return {
    id: "metric-x",
    date: today,
    checkInType: "morning",
    source: "manual",
    recordedAt: `${today}T07:00:00.000Z`,
    createdAt: `${today}T07:00:00.000Z`,
    updatedAt: `${today}T07:00:00.000Z`,
    ...overrides
  };
}

describe("computeStreak", () => {
  it("returns 0 when nothing has been completed", () => {
    expect(computeStreak([], today)).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    const tasks = [
      makeTask({ id: "a", completedAt: localIso(2026, 4, 4, 10) }),
      makeTask({ id: "b", completedAt: localIso(2026, 4, 3, 10) }),
      makeTask({ id: "c", completedAt: localIso(2026, 4, 2, 10) })
    ];

    expect(computeStreak(tasks, today)).toBe(3);
  });

  it("keeps the streak alive in the morning before today's work", () => {
    const tasks = [
      makeTask({ id: "y", completedAt: localIso(2026, 4, 3, 19) }),
      makeTask({ id: "z", completedAt: localIso(2026, 4, 2, 19) })
    ];

    expect(computeStreak(tasks, today)).toBe(2);
  });

  it("breaks the streak when a day is missed", () => {
    const tasks = [
      makeTask({ id: "today", completedAt: localIso(2026, 4, 4, 10) }),
      makeTask({ id: "two-days-ago", completedAt: localIso(2026, 4, 2, 10) })
    ];

    expect(computeStreak(tasks, today)).toBe(1);
  });
});

describe("getHeroStatus", () => {
  it("derives level, xp, hp/mp and today's quest counts", () => {
    const tasks = [
      makeTask({ id: "p1", plannedForDate: today }),
      makeTask({ id: "p2", plannedForDate: today }),
      makeTask({
        id: "done-today",
        status: "done",
        completedAt: localIso(2026, 4, 4, 11)
      }),
      makeTask({
        id: "done-history-1",
        status: "done",
        completedAt: localIso(2026, 4, 3, 11)
      }),
      makeTask({
        id: "done-history-2",
        status: "done",
        completedAt: localIso(2026, 4, 2, 11)
      }),
      makeTask({
        id: "done-history-3",
        status: "done",
        completedAt: localIso(2026, 4, 1, 11)
      }),
      makeTask({
        id: "done-history-4",
        status: "done",
        completedAt: localIso(2026, 3, 30, 11)
      }),
      makeTask({
        id: "done-history-5",
        status: "done",
        completedAt: localIso(2026, 3, 29, 11)
      })
    ];

    const metrics = [
      makeMetric({
        id: "m-yesterday",
        date: "2026-05-03",
        recordedAt: "2026-05-03T07:00:00.000Z",
        energyLevel: 3,
        moodLevel: 4
      }),
      makeMetric({
        id: "m-today",
        date: today,
        recordedAt: `${today}T07:00:00.000Z`,
        energyLevel: 4,
        moodLevel: 5
      })
    ];

    const status = getHeroStatus(tasks, metrics, today);

    expect(status.totalCompleted).toBe(6);
    expect(status.level).toBe(2);
    expect(status.xpCurrent).toBe(1);
    expect(status.xpForNextLevel).toBe(5);
    expect(status.hp).toBe(4);
    expect(status.mp).toBe(5);
    expect(status.questsToday).toEqual({ planned: 2, completed: 1 });
  });

  it("returns empty HP/MP and level 1 when no data exists", () => {
    const status = getHeroStatus([], [], today);

    expect(status.level).toBe(1);
    expect(status.xpCurrent).toBe(0);
    expect(status.hp).toBeUndefined();
    expect(status.mp).toBeUndefined();
    expect(status.streakDays).toBe(0);
    expect(status.questsToday).toEqual({ planned: 0, completed: 0 });
  });
});

describe("formatHpMp", () => {
  it("formats a known level", () => {
    expect(formatHpMp(3, 5)).toBe("3/5");
  });

  it("falls back to --/N when undefined", () => {
    expect(formatHpMp(undefined, 5)).toBe("--/5");
  });
});
