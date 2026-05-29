import { describe, expect, it } from "vitest";

import type { MetricEntry, Task } from "@/domain";
import {
  getCompletionTrend,
  getInsightHighlights,
  getMetricTrend,
  getTagBreakdown,
  getWeekProgress
} from "@/domain/insights";

const today = "2026-05-14"; // a Thursday

function localIso(year: number, monthIndex: number, day: number, hour = 12): string {
  return new Date(year, monthIndex, day, hour).toISOString();
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `t-${Math.random()}`,
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
    id: `m-${Math.random()}`,
    date: today,
    checkInType: "morning",
    source: "manual",
    recordedAt: `${today}T07:00:00.000Z`,
    createdAt: `${today}T07:00:00.000Z`,
    updatedAt: `${today}T07:00:00.000Z`,
    ...overrides
  };
}

describe("getCompletionTrend", () => {
  it("buckets completions into the last N days", () => {
    const tasks = [
      makeTask({ status: "done", completedAt: localIso(2026, 4, 14, 10) }),
      makeTask({ status: "done", completedAt: localIso(2026, 4, 14, 16) }),
      makeTask({ status: "done", completedAt: localIso(2026, 4, 13, 10) }),
      makeTask({ status: "done", completedAt: localIso(2026, 4, 1, 10) }) // outside 7-day window
    ];
    const trend = getCompletionTrend(tasks, today, 7);
    expect(trend.points).toHaveLength(7);
    expect(trend.points[trend.points.length - 1]).toMatchObject({ date: today, value: 2 });
    expect(trend.points[trend.points.length - 2]).toMatchObject({ value: 1 });
    expect(trend.total).toBe(3);
    expect(trend.best).toBe(2);
  });
});

describe("getMetricTrend", () => {
  it("averages energy and mood per day", () => {
    const metrics = [
      makeMetric({ date: today, energyLevel: 4, moodLevel: 5 }),
      makeMetric({ date: today, energyLevel: 2, moodLevel: 3 }),
      makeMetric({ date: "2026-05-13", energyLevel: 3 })
    ];
    const trend = getMetricTrend(metrics, today, 7);
    const last = trend.points[trend.points.length - 1];
    expect(last.energy).toBe(3); // (4+2)/2
    expect(last.mood).toBe(4); // (5+3)/2
    expect(trend.avgEnergy).toBeCloseTo((3 + 3) / 2, 5);
  });
});

describe("getTagBreakdown", () => {
  it("counts completed vs open per tag, sorted by volume", () => {
    const tasks = [
      makeTask({ tags: ["health"], status: "done", completedAt: localIso(2026, 4, 14) }),
      makeTask({ tags: ["health"], status: "done", completedAt: localIso(2026, 4, 13) }),
      makeTask({ tags: ["health"], status: "todo" }),
      makeTask({ tags: ["admin"], status: "todo" })
    ];
    const breakdown = getTagBreakdown(tasks);
    expect(breakdown[0]).toEqual({ tag: "health", completed: 2, open: 1 });
    expect(breakdown.find((s) => s.tag === "admin")).toEqual({
      tag: "admin",
      completed: 0,
      open: 1
    });
  });
});

describe("getWeekProgress", () => {
  it("counts completions this week against a goal", () => {
    const tasks = [
      makeTask({ status: "done", completedAt: localIso(2026, 4, 14) }),
      makeTask({ status: "done", completedAt: localIso(2026, 4, 12) }),
      makeTask({ status: "done", completedAt: localIso(2026, 4, 1) }) // outside week
    ];
    const progress = getWeekProgress(tasks, today, 10);
    expect(progress.completed).toBe(2);
    expect(progress.daysActive).toBe(2);
    expect(progress.pct).toBe(20);
  });
});

describe("getInsightHighlights", () => {
  it("returns a friendly fallback when there is no history", () => {
    const highlights = getInsightHighlights([], [], today);
    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toMatch(/Not enough history/);
  });

  it("surfaces strongest area and averages from real data", () => {
    const tasks = [
      makeTask({ tags: ["work"], status: "done", completedAt: localIso(2026, 4, 14) }),
      makeTask({ tags: ["work"], status: "done", completedAt: localIso(2026, 4, 13) })
    ];
    const metrics = [makeMetric({ energyLevel: 4, moodLevel: 4 })];
    const highlights = getInsightHighlights(tasks, metrics, today);
    expect(highlights.some((h) => h.includes("work"))).toBe(true);
    expect(highlights.some((h) => h.includes("energy"))).toBe(true);
  });
});
