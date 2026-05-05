import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { Dashboard } from "@/components/Dashboard";
import { dailyPlanStorageKey } from "@/data/dailyPlanRepository";
import { metricStorageKey } from "@/data/metricRepository";
import { taskStorageKey } from "@/data/taskRepository";
import type { DailyPlan, MetricEntry, Task } from "@/domain";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Plan the launch",
    status: "todo",
    priority: "high",
    tags: ["work"],
    createdAt: "2026-05-04T09:00:00.000Z",
    updatedAt: "2026-05-04T09:00:00.000Z",
    ...overrides
  };
}

function makePlan(overrides: Partial<DailyPlan> = {}): DailyPlan {
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;

  return {
    id: "plan-1",
    date,
    mainQuestTaskId: "main",
    sideQuestTaskIds: ["side"],
    intention: "Move the important work first.",
    status: "planned",
    createdAt: "2026-05-04T09:00:00.000Z",
    updatedAt: "2026-05-04T09:00:00.000Z",
    ...overrides
  };
}

function makeMetricEntry(overrides: Partial<MetricEntry> = {}): MetricEntry {
  return {
    id: "metric-1",
    date: "2026-05-04",
    checkInType: "morning",
    source: "manual",
    energyLevel: 4,
    moodLevel: 3,
    sleepHours: 7,
    steps: 6500,
    recordedAt: "2026-05-04T08:00:00.000Z",
    createdAt: "2026-05-04T08:00:00.000Z",
    updatedAt: "2026-05-04T08:00:00.000Z",
    ...overrides
  };
}

describe("Dashboard", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders an empty dashboard state", async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Main Quest not chosen yet.")).toBeVisible();
    });
    expect(screen.getByRole("heading", { name: "Today" })).toBeVisible();
    expect(screen.getByText("No metrics logged yet.")).toBeVisible();
  });

  it("renders tasks planned for today", async () => {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;

    window.localStorage.setItem(
      taskStorageKey,
      JSON.stringify([
        makeTask({
          id: "planned",
          title: "Planned for today",
          plannedForDate: date
        }),
        makeTask({
          id: "backlog",
          title: "Backlog item"
        })
      ])
    );

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Planned for today" })).toBeVisible();
    });
    expect(screen.queryByRole("heading", { name: "Backlog item" })).not.toBeInTheDocument();
    expect(screen.getByText("Backlog")).toBeVisible();
  });

  it("renders today's DailyPlan when one exists", async () => {
    window.localStorage.setItem(
      taskStorageKey,
      JSON.stringify([
        makeTask({ id: "main", title: "Main Quest task" }),
        makeTask({ id: "side", title: "Side Quest task" })
      ])
    );
    window.localStorage.setItem(dailyPlanStorageKey, JSON.stringify([makePlan()]));

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Move the important work first.")).toBeVisible();
    });
    expect(screen.getByRole("heading", { name: "Main Quest" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Main Quest task" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Side Quest task" })).toBeVisible();
  });

  it("renders the latest metric snapshot", async () => {
    window.localStorage.setItem(
      metricStorageKey,
      JSON.stringify([
        makeMetricEntry({ id: "old", energyLevel: 2, recordedAt: "2026-05-04T07:00:00.000Z" }),
        makeMetricEntry({ id: "latest", energyLevel: 5, recordedAt: "2026-05-04T21:00:00.000Z" })
      ])
    );

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("2026-05-04 - morning")).toBeVisible();
    });
    expect(screen.getByText("5/5")).toBeVisible();
    expect(screen.getByText("3/5")).toBeVisible();
    expect(screen.getByText("7h")).toBeVisible();
    expect(screen.getByText("6500")).toBeVisible();
  });
});
