import { describe, expect, it } from "vitest";

import type {
  DailyPlan,
  DailyReport,
  EveningPostmortem,
  JournalEntry,
  MetricEntry,
  Task
} from "@/domain";

const now = "2026-05-03T20:00:00.000Z";

describe("domain placeholder types", () => {
  it("compile with the V00 skeletal fields", () => {
    const task: Task = {
      id: "task-1",
      createdAt: now,
      updatedAt: now,
      title: "Name the first quest",
      status: "todo",
      priority: "medium",
      tags: ["learning"]
    };

    const plan: DailyPlan = {
      id: "plan-1",
      createdAt: now,
      updatedAt: now,
      date: "2026-05-03",
      mainQuestTaskId: task.id,
      sideQuestTaskIds: [],
      status: "planned"
    };

    const metric: MetricEntry = {
      id: "metric-1",
      createdAt: now,
      updatedAt: now,
      date: plan.date,
      checkInType: "morning",
      source: "manual",
      energyLevel: 4,
      moodLevel: 3,
      recordedAt: now
    };

    const postmortem: EveningPostmortem = {
      id: "postmortem-1",
      createdAt: now,
      updatedAt: now,
      date: plan.date,
      dailyPlanId: plan.id,
      taskOutcomes: [
        {
          taskId: task.id,
          outcome: "completed"
        }
      ]
    };

    const journal: JournalEntry = {
      id: "journal-1",
      createdAt: now,
      updatedAt: now,
      date: plan.date,
      type: "lesson",
      prompt: "What did I learn today?",
      content: "Keep the skeleton small.",
      source: "manual"
    };

    const report: DailyReport = {
      id: "report-1",
      createdAt: now,
      updatedAt: now,
      date: plan.date,
      markdownContent: "# Daily Report",
      generatedBy: "deterministic"
    };

    expect([task, plan, metric, postmortem, journal, report].map((item) => item.id)).toEqual([
      "task-1",
      "plan-1",
      "metric-1",
      "postmortem-1",
      "journal-1",
      "report-1"
    ]);
  });
});
