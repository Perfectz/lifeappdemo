import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { MorningStandup } from "@/components/MorningStandup";
import { dailyPlanStorageKey } from "@/data/dailyPlanRepository";
import { taskStorageKey } from "@/data/taskRepository";
import type { DailyPlan, Task } from "@/domain";

const now = "2026-05-04T09:00:00.000Z";

function todayIsoDate(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Plan V03",
    status: "todo",
    priority: "medium",
    tags: [],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function makePlan(overrides: Partial<DailyPlan> = {}): DailyPlan {
  return {
    id: "plan-1",
    date: todayIsoDate(),
    mainQuestTaskId: "task-1",
    sideQuestTaskIds: [],
    status: "planned",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("MorningStandup", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows active tasks as planning options", async () => {
    window.localStorage.setItem(
      taskStorageKey,
      JSON.stringify([
        makeTask({ id: "active", title: "Choose me" }),
        makeTask({ id: "done", title: "Already done", status: "done" })
      ])
    );

    render(<MorningStandup />);

    await waitFor(() => {
      expect(screen.getAllByText("Choose me").length).toBeGreaterThan(0);
    });
    expect(screen.queryByText("Already done")).not.toBeInTheDocument();
  });

  it("adds a quick task to selectable planning options", async () => {
    render(<MorningStandup />);

    await waitFor(() => {
      expect(screen.getByText("No open tasks yet. Create one to start planning.")).toBeVisible();
    });

    fireEvent.change(screen.getByLabelText("Quick Quest"), {
      target: { value: "Quick capture" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Quick Quest" }));

    await waitFor(() => {
      expect(screen.getAllByText("Quick capture").length).toBeGreaterThan(0);
    });
  });

  it("loads an existing plan for editing", async () => {
    window.localStorage.setItem(taskStorageKey, JSON.stringify([makeTask()]));
    window.localStorage.setItem(
      dailyPlanStorageKey,
      JSON.stringify([makePlan({ intention: "Edit the day." })])
    );

    render(<MorningStandup />);

    await waitFor(() => {
      expect(screen.getByText("Edit today's plan.")).toBeVisible();
    });
    expect(screen.getByLabelText("Intention")).toHaveValue("Edit the day.");
  });
});
