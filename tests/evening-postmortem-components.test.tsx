import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { EveningPostmortem } from "@/components/EveningPostmortem";
import { dailyPlanStorageKey } from "@/data/dailyPlanRepository";
import { eveningPostmortemStorageKey } from "@/data/eveningPostmortemRepository";
import { taskStorageKey } from "@/data/taskRepository";
import type { DailyPlan, Task } from "@/domain";

const now = "2026-05-04T20:00:00.000Z";

function todayIsoDate(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Close the loop",
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
    sideQuestTaskIds: ["task-2"],
    status: "planned",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("EveningPostmortem", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders planned tasks from today's DailyPlan", async () => {
    window.localStorage.setItem(
      taskStorageKey,
      JSON.stringify([
        makeTask({ id: "task-1", title: "Main Quest" }),
        makeTask({ id: "task-2", title: "Side Quest" })
      ])
    );
    window.localStorage.setItem(dailyPlanStorageKey, JSON.stringify([makePlan()]));

    render(<EveningPostmortem />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Main Quest" })).toBeVisible();
    });
    expect(screen.getByRole("heading", { name: "Side Quest" })).toBeVisible();
  });

  it("persists reflection input when saved", async () => {
    window.localStorage.setItem(taskStorageKey, JSON.stringify([makeTask()]));
    window.localStorage.setItem(
      dailyPlanStorageKey,
      JSON.stringify([makePlan({ sideQuestTaskIds: [] })])
    );

    render(<EveningPostmortem />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Close the loop" })).toBeVisible();
    });

    fireEvent.change(screen.getByLabelText("Wins"), {
      target: { value: "Completed the core loop." }
    });
    fireEvent.change(screen.getByLabelText("Friction"), {
      target: { value: "Too many moving parts." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Postmortem" }));

    await waitFor(() => {
      expect(screen.getByText("Today's Daily Plan is closed.")).toBeVisible();
    });
    expect(screen.getByText("Completed the core loop.")).toBeVisible();
    expect(screen.getByText("Too many moving parts.")).toBeVisible();

    const raw = window.localStorage.getItem(eveningPostmortemStorageKey);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw ?? "[]")[0]).toMatchObject({
      wins: "Completed the core loop.",
      friction: "Too many moving parts."
    });
  });

  it("renders no-plan fallback", async () => {
    render(<EveningPostmortem />);

    await waitFor(() => {
      expect(screen.getByText("No Daily Plan exists for today.")).toBeVisible();
    });
    expect(screen.getByRole("link", { name: "Create Morning Plan" })).toBeVisible();
  });
});
