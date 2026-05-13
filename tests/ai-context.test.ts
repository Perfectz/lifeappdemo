import { describe, expect, it } from "vitest";

import type { DailyReport, JournalEntry, MetricEntry, Task } from "@/domain";
import {
  buildAIAppContext,
  formatAIContextForPrompt,
  summarizeAIAppContext,
  validateAIChatRequestBody
} from "@/domain/aiContext";

const today = "2026-05-04";
const now = "2026-05-04T10:00:00.000Z";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Focus on the main quest",
    status: "todo",
    priority: "high",
    tags: ["work"],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function makeMetric(overrides: Partial<MetricEntry> = {}): MetricEntry {
  return {
    id: "metric-1",
    date: today,
    checkInType: "morning",
    source: "manual",
    energyLevel: 4,
    moodLevel: 3,
    kettlebellSwingsTotal: 100,
    karateClass: true,
    distanceWalkedMiles: 2,
    recordedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function makeJournal(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: "journal-1",
    date: today,
    type: "lesson",
    content: "Keep the AI read-only first.",
    source: "manual",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function makeReport(overrides: Partial<DailyReport> = {}): DailyReport {
  return {
    id: "report-1",
    date: today,
    markdownContent: "# Report\n\nUseful context.",
    generatedBy: "deterministic",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("AI context", () => {
  it("validates chat request bodies", () => {
    expect(validateAIChatRequestBody({ message: " Help ", mode: "general" })).toEqual({
      ok: true,
      value: { message: "Help", mode: "general", appData: undefined }
    });
    expect(validateAIChatRequestBody({ message: "", mode: "general" })).toMatchObject({
      ok: false,
      message: "Message is required."
    });
    expect(validateAIChatRequestBody({ message: "Help", mode: "mutate" })).toMatchObject({
      ok: false,
      message: "Mode is invalid."
    });
  });

  it("builds compact recent context and excludes archived tasks", () => {
    const context = buildAIAppContext(
      {
        tasks: [
          makeTask({ id: "active-task" }),
          makeTask({ id: "archived-task", status: "archived", title: "Archived task" })
        ],
        metricEntries: [makeMetric({ id: "metric-old", recordedAt: "2026-05-03T10:00:00.000Z" }), makeMetric()],
        journalEntries: [makeJournal()],
        dailyReports: [makeReport()]
      },
      today
    );

    expect(context.openTasks.map((task) => task.id)).toEqual(["active-task"]);
    expect(context.recentMetrics.map((metric) => metric.id)).toEqual(["metric-1", "metric-old"]);
    expect(context.recentJournalEntries).toHaveLength(1);
    expect(context.latestReport?.id).toBe("report-1");
    expect(summarizeAIAppContext(context)).toEqual({
      openTaskCount: 1,
      recentMetricCount: 2,
      recentJournalEntryCount: 1
    });
  });

  it("formats prompt context without secrets or archived task content", () => {
    const context = buildAIAppContext(
      {
        tasks: [makeTask(), makeTask({ id: "archived", status: "archived", title: "Do not include" })],
        metricEntries: [makeMetric()],
        journalEntries: [makeJournal()]
      },
      today
    );
    const prompt = formatAIContextForPrompt(context);

    expect(prompt).toContain("Focus on the main quest");
    expect(prompt).toContain("id: task-1");
    expect(prompt).toContain("energy 4/5");
    expect(prompt).toContain("100 kettlebell swings");
    expect(prompt).toContain("karate class");
    expect(prompt).toContain("2 mi walked");
    expect(prompt).toContain("Keep the AI read-only first.");
    expect(prompt).not.toContain("Do not include");
    expect(prompt).not.toContain("OPENAI_API_KEY");
  });
});
