import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { openQuickAddEventName } from "@/client/quickAdd";
import { QuickAddQuest } from "@/components/QuickAddQuest";
import { taskStorageKey } from "@/data/taskRepository";
import type { Task } from "@/domain";

vi.mock("@/client/celebrate", () => ({
  celebrate: vi.fn()
}));

function openModal() {
  render(<QuickAddQuest />);
  fireEvent(window, new CustomEvent(openQuickAddEventName));
}

function titleInput(): HTMLInputElement {
  return screen.getByLabelText("Quest title");
}

function savedTasks(): Task[] {
  return JSON.parse(window.localStorage.getItem(taskStorageKey) ?? "[]") as Task[];
}

describe("QuickAddQuest natural-language capture", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    // 2026-07-09 is a Thursday.
    vi.setSystemTime(new Date(2026, 6, 9, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a date chip and cleaned-title preview while typing", () => {
    openModal();
    fireEvent.change(titleInput(), { target: { value: "call mom tomorrow" } });

    expect(screen.getByText(/Fri · Jul 10/)).toBeVisible();
    expect(screen.getByText("“call mom”")).toBeVisible();
  });

  it("shows a recurrence chip for repeat phrases", () => {
    openModal();
    fireEvent.change(titleInput(), { target: { value: "journal daily" } });

    expect(screen.getByText(/↻ Daily/)).toBeVisible();
    expect(screen.getByText("“journal”")).toBeVisible();
  });

  it("submits the parsed title, due date, and recurrence", () => {
    openModal();
    fireEvent.change(titleInput(), { target: { value: "team sync every monday" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Quest" }));

    const [task] = savedTasks();
    expect(task.title).toBe("team sync");
    expect(task.dueDate).toBe("2026-07-13");
    expect(task.recurrence).toEqual({ frequency: "weekly" });
  });

  it("auto-unchecks plan-today for a future date and omits plannedForDate", () => {
    openModal();
    fireEvent.change(titleInput(), { target: { value: "submit report friday" } });

    expect(screen.getByLabelText("Plan for today")).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Add Quest" }));

    const [task] = savedTasks();
    expect(task.title).toBe("submit report");
    expect(task.dueDate).toBe("2026-07-10");
    expect(task.plannedForDate).toBeUndefined();
  });

  it("lets the user re-check plan-today after the auto-uncheck", () => {
    openModal();
    fireEvent.change(titleInput(), { target: { value: "submit report friday" } });
    fireEvent.click(screen.getByLabelText("Plan for today"));
    fireEvent.click(screen.getByRole("button", { name: "Add Quest" }));

    const [task] = savedTasks();
    expect(task.dueDate).toBe("2026-07-10");
    expect(task.plannedForDate).toBe("2026-07-09");
  });

  it("keeps plan-today checked for a 'today' phrase", () => {
    openModal();
    fireEvent.change(titleInput(), { target: { value: "ship update today" } });

    expect(screen.getByLabelText("Plan for today")).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Add Quest" }));

    const [task] = savedTasks();
    expect(task.title).toBe("ship update");
    expect(task.dueDate).toBe("2026-07-09");
    expect(task.plannedForDate).toBe("2026-07-09");
  });

  it("rejecting the parse keeps the raw text as the title", () => {
    openModal();
    fireEvent.change(titleInput(), { target: { value: "call mom tomorrow" } });
    fireEvent.click(screen.getByRole("button", { name: "Ignore detected date" }));

    expect(screen.queryByText(/Fri · Jul 10/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Add Quest" }));

    const [task] = savedTasks();
    expect(task.title).toBe("call mom tomorrow");
    expect(task.dueDate).toBeUndefined();
    expect(task.recurrence).toBeUndefined();
    // Rejecting the future date restores the plan-today default.
    expect(task.plannedForDate).toBe("2026-07-09");
  });

  it("shows no chip row for plain titles", () => {
    openModal();
    fireEvent.change(titleInput(), { target: { value: "refactor auth module" } });

    expect(screen.queryByRole("button", { name: "Ignore detected date" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Add Quest" }));

    const [task] = savedTasks();
    expect(task.title).toBe("refactor auth module");
    expect(task.dueDate).toBeUndefined();
  });

  it("still merges the manual priority and tag controls with the parse", () => {
    openModal();
    fireEvent.change(titleInput(), { target: { value: "leg day tomorrow" } });
    fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "high" } });
    fireEvent.change(screen.getByLabelText("Tag"), { target: { value: "health" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Quest" }));

    const [task] = savedTasks();
    expect(task.title).toBe("leg day");
    expect(task.priority).toBe("high");
    expect(task.tags).toEqual(["health"]);
    expect(task.dueDate).toBe("2026-07-10");
  });
});
