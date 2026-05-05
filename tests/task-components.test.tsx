import { fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { TaskForm } from "@/components/TaskForm";
import { TaskGroup } from "@/components/TaskGroup";
import type { Task } from "@/domain";

const task: Task = {
  id: "task-1",
  title: "Write the Quest Log",
  description: "Keep it narrow.",
  status: "todo",
  priority: "high",
  tags: ["work", "learning"],
  createdAt: "2026-05-03T20:00:00.000Z",
  updatedAt: "2026-05-03T20:00:00.000Z"
};

describe("task components", () => {
  it("validates task title before submitting", () => {
    const onSubmit = vi.fn();

    render(<TaskForm buttonLabel="Add Quest" onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Add Quest" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Quest title is required.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits a valid task form payload", () => {
    const onSubmit = vi.fn();

    render(<TaskForm buttonLabel="Add Quest" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Quest Title"), {
      target: { value: "Plan launch" }
    });
    fireEvent.change(screen.getByLabelText("Priority"), {
      target: { value: "high" }
    });
    fireEvent.click(screen.getByLabelText("content"));
    fireEvent.click(screen.getByRole("button", { name: "Add Quest" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Plan launch",
        priority: "high",
        tags: ["content"]
      })
    );
  });

  it("renders task list groups by status section", () => {
    render(
      <TaskGroup
        emptyMessage="No active quests."
        onArchive={vi.fn()}
        onComplete={vi.fn()}
        onReopen={vi.fn()}
        onUpdate={vi.fn()}
        tasks={[task]}
        title="Active Quests"
      />
    );

    const group = screen.getByRole("region", { name: "Active Quests" });

    expect(within(group).getByRole("heading", { name: "Active Quests" })).toBeVisible();
    expect(within(group).getByRole("heading", { name: "Write the Quest Log" })).toBeVisible();
    expect(within(group).getByText("high")).toBeVisible();
    expect(within(group).getByText("work")).toBeVisible();
  });
});
