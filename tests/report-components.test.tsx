import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DailyReportExport } from "@/components/DailyReportExport";
import { dailyPlanStorageKey } from "@/data/dailyPlanRepository";
import { dailyReportStorageKey } from "@/data/dailyReportRepository";
import { eveningPostmortemStorageKey } from "@/data/eveningPostmortemRepository";
import { journalStorageKey } from "@/data/journalRepository";
import { metricStorageKey } from "@/data/metricRepository";
import { taskStorageKey } from "@/data/taskRepository";

const date = "2026-05-04";
const now = "2026-05-04T20:00:00.000Z";

function seedReportData() {
  window.localStorage.setItem(
    taskStorageKey,
    JSON.stringify([
      {
        id: "task-1",
        title: "Draft the markdown report",
        status: "done",
        priority: "high",
        tags: ["content"],
        plannedForDate: date,
        completedAt: now,
        createdAt: now,
        updatedAt: now
      }
    ])
  );
  window.localStorage.setItem(
    dailyPlanStorageKey,
    JSON.stringify([
      {
        id: "plan-1",
        date,
        mainQuestTaskId: "task-1",
        sideQuestTaskIds: [],
        intention: "Export the day clearly.",
        status: "closed",
        createdAt: now,
        updatedAt: now
      }
    ])
  );
  window.localStorage.setItem(
    eveningPostmortemStorageKey,
    JSON.stringify([
      {
        id: "postmortem-1",
        date,
        dailyPlanId: "plan-1",
        taskOutcomes: [{ taskId: "task-1", outcome: "completed" }],
        wins: "Markdown is readable.",
        friction: "Clipboard needed a mock.",
        lessonsLearned: "Export plain text first.",
        tomorrowFollowUps: "Use report as V08 context.",
        createdAt: now,
        updatedAt: now
      }
    ])
  );
  window.localStorage.setItem(
    metricStorageKey,
    JSON.stringify([
      {
        id: "metric-1",
        date,
        checkInType: "evening",
        source: "manual",
        energyLevel: 5,
        moodLevel: 4,
        steps: 8000,
        recordedAt: now,
        createdAt: now,
        updatedAt: now
      }
    ])
  );
  window.localStorage.setItem(
    journalStorageKey,
    JSON.stringify([
      {
        id: "journal-1",
        date,
        type: "lesson",
        prompt: "What did I learn today?",
        content: "Reports should preserve raw truth.",
        source: "manual",
        createdAt: now,
        updatedAt: now
      }
    ])
  );
}

describe("DailyReportExport", () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    });
  });

  it("renders generated Markdown from stored app data", async () => {
    seedReportData();
    render(<DailyReportExport />);

    fireEvent.change(screen.getByLabelText("Date"), { target: { value: date } });
    fireEvent.click(screen.getByRole("button", { name: "Generate Preview" }));

    await waitFor(() => {
      expect(screen.getByText("Markdown report generated.")).toBeVisible();
    });
    expect(screen.getByText(/Draft the markdown report/)).toBeVisible();
    expect(screen.getByText(/energy 5\/5/)).toBeVisible();
    expect(screen.getByText(/Reports should preserve raw truth/)).toBeVisible();
    expect(JSON.parse(window.localStorage.getItem(dailyReportStorageKey) ?? "[]")).toHaveLength(1);
  });

  it("copies the generated Markdown to the clipboard", async () => {
    seedReportData();
    render(<DailyReportExport />);

    fireEvent.change(screen.getByLabelText("Date"), { target: { value: date } });
    fireEvent.click(screen.getByRole("button", { name: "Generate Preview" }));
    await waitFor(() => {
      expect(screen.getByText(/Draft the markdown report/)).toBeVisible();
    });

    fireEvent.click(screen.getByRole("button", { name: "Copy to Clipboard" }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("Draft the markdown report")
      );
    });
  });

  it("loads a persisted report for the selected date", async () => {
    const storedMarkdown = "# LifeQuest Daily Report - 2026-05-04\n\nPersisted report";
    window.localStorage.setItem(
      dailyReportStorageKey,
      JSON.stringify([
        {
          id: "report-1",
          date,
          markdownContent: storedMarkdown,
          generatedBy: "deterministic",
          createdAt: now,
          updatedAt: now
        }
      ])
    );

    render(<DailyReportExport />);

    await waitFor(() => {
      expect(screen.getByText(/Persisted report/)).toBeVisible();
    });
  });
});
