import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { GoalsWorkspace } from "@/components/GoalsWorkspace";
import { createLocalGoalRepository } from "@/data/goalRepository";
import { createLocalTaskRepository } from "@/data/taskRepository";

describe("GoalsWorkspace", () => {
  beforeEach(() => window.localStorage.clear());

  it("creates a goal and turns its next step into a linked quest", async () => {
    render(<GoalsWorkspace />);

    fireEvent.change(screen.getByLabelText("Goal"), {
      target: { value: "Build a sustainable training habit" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create goal" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Build a sustainable training habit" })).toBeVisible()
    );

    const [goal] = createLocalGoalRepository(window.localStorage).load();
    expect(goal.title).toBe("Build a sustainable training habit");

    fireEvent.change(
      screen.getByLabelText("Next quest for Build a sustainable training habit"),
      { target: { value: "Schedule Monday workout" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Add for today" }));

    const [task] = createLocalTaskRepository(window.localStorage).load();
    expect(task).toMatchObject({
      title: "Schedule Monday workout",
      linkedGoalId: goal.id,
      plannedForDate: expect.any(String)
    });
  });
});
