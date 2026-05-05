import { describe, expect, it } from "vitest";

import type { DailyPlan, EveningPostmortem, JournalEntry, MetricEntry, Task } from "@/domain";
import { getTomorrowIsoDate } from "@/domain/dates";
import {
  generateDailyReport,
  getDailyReportFilename,
  upsertDailyReport,
  validateGenerateDailyReportPayload
} from "@/domain/reports";

const date = "2026-05-04";
const now = "2026-05-04T20:00:00.000Z";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Ship the report slice",
    status: "done",
    priority: "high",
    tags: ["work"],
    plannedForDate: date,
    completedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function makePlan(overrides: Partial<DailyPlan> = {}): DailyPlan {
  return {
    id: "plan-1",
    date,
    mainQuestTaskId: "task-1",
    sideQuestTaskIds: [],
    intention: "Turn the day into useful output.",
    status: "closed",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function makePostmortem(overrides: Partial<EveningPostmortem> = {}): EveningPostmortem {
  return {
    id: "postmortem-1",
    date,
    dailyPlanId: "plan-1",
    taskOutcomes: [{ taskId: "task-1", outcome: "completed" }],
    wins: "Report preview works.",
    friction: "Download behavior needed browser coverage.",
    lessonsLearned: "Keep exports deterministic first.",
    tomorrowFollowUps: "Review V08 context shape.",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function makeMetric(overrides: Partial<MetricEntry> = {}): MetricEntry {
  return {
    id: "metric-1",
    date,
    checkInType: "evening",
    source: "manual",
    energyLevel: 4,
    moodLevel: 3,
    steps: 6200,
    recordedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function makeJournal(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: "journal-1",
    date,
    type: "lesson",
    prompt: "What did I learn today?",
    content: "Small deterministic exports are easier to trust.",
    source: "manual",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("daily report generator", () => {
  it("includes known task, metric, reflection, and journal values", () => {
    const report = generateDailyReport(
      {
        date,
        tasks: [makeTask()],
        dailyPlan: makePlan(),
        eveningPostmortem: makePostmortem(),
        metricEntries: [makeMetric()],
        journalEntries: [makeJournal()]
      },
      now
    );

    expect(report.generatedBy).toBe("deterministic");
    expect(report.markdownContent).toContain("# LifeQuest Daily Report - 2026-05-04");
    expect(report.markdownContent).toContain("Ship the report slice");
    expect(report.markdownContent).toContain("energy 4/5");
    expect(report.markdownContent).toContain("Report preview works.");
    expect(report.markdownContent).toContain("Small deterministic exports are easier to trust.");
  });

  it("labels missing data instead of inventing content", () => {
    const report = generateDailyReport(
      {
        date,
        tasks: [],
        metricEntries: [],
        journalEntries: []
      },
      now
    );

    expect(report.markdownContent).toContain("Not logged");
    expect(report.markdownContent).toContain("No entry captured");
    expect(report.markdownContent).toContain("- Daily plan not logged.");
    expect(report.markdownContent).toContain("- Metrics not logged.");
  });

  it("validates report generation payloads", () => {
    expect(
      validateGenerateDailyReportPayload({
        date,
        style: "ai_assisted",
        includeLinkedInSourceMaterial: true
      })
    ).toMatchObject({ ok: true });
    expect(
      validateGenerateDailyReportPayload({
        date,
        style: "invented",
        includeLinkedInSourceMaterial: true
      })
    ).toMatchObject({ ok: false, message: "Report style is invalid." });
  });

  it("builds an AI-assisted report from stored facts and missing labels", () => {
    const report = generateDailyReport(
      {
        date,
        tasks: [makeTask()],
        dailyPlan: makePlan(),
        eveningPostmortem: makePostmortem(),
        metricEntries: [],
        journalEntries: [],
        generatedBy: "ai",
        includeLinkedInSourceMaterial: true
      },
      now
    );

    expect(report.generatedBy).toBe("ai");
    expect(report.markdownContent).toContain("Generated from stored LifeQuest facts only.");
    expect(report.markdownContent).toContain("Ship the report slice");
    expect(report.markdownContent).toContain("- Metrics not logged.");
    expect(report.markdownContent).not.toContain("10,000 steps");
  });

  it("returns tomorrow as a local ISO date", () => {
    expect(getTomorrowIsoDate("2026-05-04")).toBe("2026-05-05");
  });

  it("returns the required date-based filename", () => {
    expect(getDailyReportFilename(date)).toBe("lifequest-report-2026-05-04.md");
  });

  it("upserts the latest report for a date", () => {
    const original = generateDailyReport(
      { date, tasks: [], metricEntries: [], journalEntries: [] },
      now
    );
    const replacement = generateDailyReport(
      {
        date,
        tasks: [makeTask({ title: "Replacement report task" })],
        dailyPlan: makePlan(),
        metricEntries: [],
        journalEntries: []
      },
      "2026-05-04T21:00:00.000Z"
    );

    const reports = upsertDailyReport([original], replacement);

    expect(reports).toHaveLength(1);
    expect(reports[0].id).toBe(original.id);
    expect(reports[0].markdownContent).toContain("Replacement report task");
  });
});
