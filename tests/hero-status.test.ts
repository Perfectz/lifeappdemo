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
    expect(status.totalXp).toBe(6);
    expect(status.level).toBe(2);
    expect(status.xpCurrent).toBe(1);
    expect(status.xpForNextLevel).toBe(5);
    expect(status.hp).toBe(4);
    expect(status.mp).toBe(5);
    expect(status.questsToday).toEqual({ planned: 2, completed: 1 });
  });

  it("REGRESSION: legacy tasks without difficulty produce the exact pre-XP levels", () => {
    // Before difficulty existed: level = floor(totalCompleted / 5) + 1,
    // xpCurrent = totalCompleted % 5. Every legacy fixture must still land
    // on those numbers to the digit.
    for (const completedCount of [0, 1, 4, 5, 6, 12, 25, 37]) {
      const tasks = Array.from({ length: completedCount }, (_, index) =>
        makeTask({
          id: `legacy-${index}`,
          status: "done",
          completedAt: localIso(2026, 4, 1, 10)
        })
      );

      const status = getHeroStatus(tasks, [], today);

      expect(status.level).toBe(Math.floor(completedCount / 5) + 1);
      expect(status.xpCurrent).toBe(completedCount % 5);
      expect(status.totalXp).toBe(completedCount);
      expect(status.totalCompleted).toBe(completedCount);
    }
  });

  it("weights XP by difficulty: quick/standard 1, hard 2, epic 4", () => {
    const tasks = [
      makeTask({ id: "q", status: "done", difficulty: "quick", completedAt: localIso(2026, 4, 4, 9) }),
      makeTask({ id: "s", status: "done", completedAt: localIso(2026, 4, 4, 10) }),
      makeTask({ id: "h", status: "done", difficulty: "hard", completedAt: localIso(2026, 4, 4, 11) }),
      makeTask({ id: "e", status: "done", difficulty: "epic", completedAt: localIso(2026, 4, 4, 12) }),
      makeTask({ id: "open-epic", difficulty: "epic", plannedForDate: today })
    ];

    const status = getHeroStatus(tasks, [], today);

    // 1 + 1 + 2 + 4 = 8 XP -> level 2 with 3 XP into the bar.
    expect(status.totalXp).toBe(8);
    expect(status.level).toBe(2);
    expect(status.xpCurrent).toBe(3);
    // Counts stay task-based: 4 completed today, 1 planned.
    expect(status.totalCompleted).toBe(4);
    expect(status.questsToday).toEqual({ planned: 1, completed: 4 });
  });

  it("an epic completion can jump a whole level in one clear", () => {
    const before = [
      makeTask({ id: "a", status: "done", completedAt: localIso(2026, 4, 3, 10) }),
      makeTask({ id: "b", status: "done", completedAt: localIso(2026, 4, 3, 11) })
    ];
    const after = [
      ...before,
      makeTask({ id: "boss", status: "done", difficulty: "epic", completedAt: localIso(2026, 4, 4, 10) })
    ];

    // 2 XP -> level 1; +4 XP epic -> 6 XP -> level 2. AppShell's watcher
    // compares consecutive getHeroStatus snapshots, so this delta is what
    // fires the levelup celebration.
    expect(getHeroStatus(before, [], today).level).toBe(1);
    expect(getHeroStatus(after, [], today).level).toBe(2);
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
