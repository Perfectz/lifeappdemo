import { describe, expect, it } from "vitest";

import type { DemoDataSet, MetricEntry, Task } from "@/domain";
import { countDemoData, createDemoDataSet, hasDemoData, removeDemoData, seedDemoData } from "@/domain/demoData";

const today = "2026-05-05";
const now = "2026-05-05T12:00:00.000Z";

function emptyData(): DemoDataSet {
  return {
    dailyPlans: [],
    dailyReports: [],
    eveningPostmortems: [],
    journalEntries: [],
    metricEntries: [],
    tasks: []
  };
}

describe("demo data", () => {
  it("seeds fake records with demo markings where supported", () => {
    const demoData = createDemoDataSet(today, now);

    expect(demoData.tasks.every((task) => task.id.startsWith("demo-"))).toBe(true);
    expect(demoData.dailyPlans.every((plan) => plan.id.startsWith("demo-"))).toBe(true);
    expect(demoData.dailyReports.every((report) => report.id.startsWith("demo-"))).toBe(true);
    expect(demoData.metricEntries.every((metric) => metric.source === "demo")).toBe(true);
    expect(demoData.journalEntries.every((journalEntry) => journalEntry.source === "demo")).toBe(true);
    expect(hasDemoData(demoData)).toBe(true);
  });

  it("reset removes only demo records and preserves real records", () => {
    const realTask: Task = {
      id: "real-task",
      title: "Real quest",
      status: "todo",
      priority: "high",
      tags: ["work"],
      createdAt: now,
      updatedAt: now
    };
    const realMetric: MetricEntry = {
      id: "real-metric",
      date: today,
      checkInType: "morning",
      source: "manual",
      steps: 1234,
      recordedAt: now,
      createdAt: now,
      updatedAt: now
    };
    const seeded = seedDemoData(
      {
        ...emptyData(),
        metricEntries: [realMetric],
        tasks: [realTask]
      },
      today
    );
    const result = removeDemoData(seeded);

    expect(countDemoData(seeded).tasks).toBeGreaterThan(0);
    expect(result.removed.tasks).toBeGreaterThan(0);
    expect(result.data.tasks).toEqual([realTask]);
    expect(result.data.metricEntries).toEqual([realMetric]);
    expect(hasDemoData(result.data)).toBe(false);
  });
});
