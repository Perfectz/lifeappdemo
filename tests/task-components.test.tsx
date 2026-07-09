import { act, fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { celebrateEventName, type CelebrationDetail } from "@/client/celebrate";
import { QuestLog } from "@/components/QuestLog";
import { TaskCard } from "@/components/TaskCard";
import { TaskForm } from "@/components/TaskForm";
import { TaskGroup } from "@/components/TaskGroup";
import { createLocalTaskRepository, taskStorageKey } from "@/data/taskRepository";
import type { Task } from "@/domain";
import { localIsoDateToday } from "@/domain/tasks";

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

  it("submits a repeat frequency and checklist steps from the form", () => {
    const onSubmit = vi.fn();

    render(<TaskForm buttonLabel="Add Quest" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Quest Title"), {
      target: { value: "Morning mobility" }
    });
    fireEvent.change(screen.getByLabelText("Repeat"), { target: { value: "weekdays" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Add step" }));
    fireEvent.change(screen.getByLabelText("Checklist step 1"), {
      target: { value: "Neck rolls" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Quest" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Morning mobility",
        recurrence: { frequency: "weekdays" },
        checklist: [expect.objectContaining({ text: "Neck rolls", done: false })]
      })
    );
  });

  it("submits a difficulty tier from the form and defaults to standard", () => {
    const onSubmit = vi.fn();

    render(<TaskForm buttonLabel="Add Quest" onSubmit={onSubmit} />);

    const select = screen.getByLabelText("Difficulty");
    expect(select).toHaveValue("standard");
    expect(
      within(select as HTMLElement).getByRole("option", { name: "Epic 👑 (+4 XP)" })
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Quest Title"), {
      target: { value: "Slay the deadline" }
    });
    fireEvent.change(select, { target: { value: "epic" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Quest" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Slay the deadline", difficulty: "epic" })
    );
  });

  it("normalizes the default standard difficulty to absence on submit", () => {
    const onSubmit = vi.fn();

    render(<TaskForm buttonLabel="Add Quest" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Quest Title"), { target: { value: "Plain" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Quest" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ difficulty: undefined })
    );
  });

  it("removes a checklist line before submitting", () => {
    const onSubmit = vi.fn();

    render(<TaskForm buttonLabel="Add Quest" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Quest Title"), { target: { value: "Quest" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Add step" }));
    fireEvent.change(screen.getByLabelText("Checklist step 1"), {
      target: { value: "Doomed step" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove checklist step 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Quest" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ checklist: undefined })
    );
  });
});

describe("task card", () => {
  const checklistTask: Task = {
    ...task,
    recurrence: { frequency: "weekly" },
    checklist: [
      { id: "c1", text: "Draft outline", done: true },
      { id: "c2", text: "Write intro", done: false }
    ]
  };

  function renderCard(onUpdate = vi.fn()) {
    render(
      <ul>
        <TaskCard
          onArchive={vi.fn()}
          onComplete={vi.fn()}
          onReopen={vi.fn()}
          onUpdate={onUpdate}
          task={checklistTask}
        />
      </ul>
    );
    return onUpdate;
  }

  it("shows the recurrence badge and checklist progress", () => {
    renderCard();

    expect(screen.getByTitle("Repeats weekly")).toHaveTextContent("Weekly");
    expect(screen.getByLabelText("1 of 2 steps done")).toHaveTextContent("1/2");
  });

  it("renders checklist items and toggles through the update path", () => {
    const onUpdate = renderCard();

    const checklist = screen.getByRole("list", { name: "Write the Quest Log checklist" });
    const intro = within(checklist).getByLabelText("Write intro");

    expect(within(checklist).getByLabelText("Draft outline")).toBeChecked();
    expect(intro).not.toBeChecked();

    fireEvent.click(intro);

    expect(onUpdate).toHaveBeenCalledWith(
      checklistTask,
      expect.objectContaining({
        checklist: [
          { id: "c1", text: "Draft outline", done: true },
          { id: "c2", text: "Write intro", done: true }
        ]
      })
    );
  });

  function renderTask(taskOverrides: Partial<Task>, handlers: { onComplete?: ReturnType<typeof vi.fn> } = {}) {
    render(
      <ul>
        <TaskCard
          onArchive={vi.fn()}
          onComplete={handlers.onComplete ?? vi.fn()}
          onReopen={vi.fn()}
          onUpdate={vi.fn()}
          task={{ ...task, ...taskOverrides }}
        />
      </ul>
    );
  }

  it("shows a difficulty badge for epic quests and none for standard", () => {
    renderTask({ difficulty: "epic" });

    expect(screen.getByRole("img", { name: "Epic quest, worth 4 XP" })).toBeVisible();
  });

  it("renders no difficulty badge on standard/legacy quests", () => {
    renderTask({});

    expect(screen.queryByRole("img", { name: /quest, worth/ })).not.toBeInTheDocument();
  });

  it("shows the earned XP on the cleared row of hard and epic quests", () => {
    renderTask({
      difficulty: "hard",
      status: "done",
      completedAt: "2026-05-04T10:00:00.000Z"
    });

    expect(screen.getByText("+2 XP")).toBeVisible();
  });

  it("completes the quest through the one-tap circle with an accessible name", () => {
    const onComplete = vi.fn();
    renderTask({ difficulty: "epic" }, { onComplete });

    const tap = screen.getByRole("button", { name: "Complete Write the Quest Log" });
    expect(tap.className).toContain("quest-complete-tap-epic");

    fireEvent.click(tap);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0]).toMatchObject({ id: "task-1", difficulty: "epic" });
  });

  it("hides the one-tap circle on completed quests", () => {
    renderTask({ status: "done", completedAt: "2026-05-04T10:00:00.000Z" });

    expect(
      screen.queryByRole("button", { name: "Complete Write the Quest Log" })
    ).not.toBeInTheDocument();
  });
});

describe("quest log view", () => {
  const today = localIsoDateToday();

  function shiftDate(days: number): string {
    const [year, month, day] = today.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + days));
    return date.toISOString().slice(0, 10);
  }

  function seedTasks(tasks: Task[]) {
    window.localStorage.setItem(taskStorageKey, JSON.stringify(tasks));
  }

  function storedTasks(): Task[] {
    return JSON.parse(window.localStorage.getItem(taskStorageKey) ?? "[]") as Task[];
  }

  function makeTask(overrides: Partial<Task>): Task {
    return {
      id: `task-${Math.random()}`,
      title: "Quest",
      status: "todo",
      priority: "medium",
      tags: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      ...overrides
    };
  }

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("groups active quests into date-aware sections", () => {
    seedTasks([
      makeTask({ id: "late", title: "Late quest", dueDate: shiftDate(-2) }),
      makeTask({ id: "now", title: "Today quest", dueDate: today }),
      makeTask({ id: "soon", title: "Soon quest", dueDate: shiftDate(5) }),
      makeTask({ id: "someday", title: "Someday quest" })
    ]);

    render(<QuestLog />);

    expect(
      within(screen.getByRole("region", { name: "Overdue" })).getByText("Late quest")
    ).toBeVisible();
    expect(
      within(screen.getByRole("region", { name: "Today" })).getByText("Today quest")
    ).toBeVisible();
    expect(
      within(screen.getByRole("region", { name: "Upcoming" })).getByText("Soon quest")
    ).toBeVisible();
    expect(
      within(screen.getByRole("region", { name: "Someday" })).getByText("Someday quest")
    ).toBeVisible();
  });

  it("filters by search and shows the N of M summary", () => {
    seedTasks([
      makeTask({ id: "a", title: "Ship the report", tags: ["work"] }),
      makeTask({ id: "b", title: "Walk the dog", tags: ["health"] })
    ]);

    render(<QuestLog />);

    fireEvent.change(screen.getByLabelText("Search quests"), {
      target: { value: "ship" }
    });

    expect(screen.getByRole("status")).toHaveTextContent("1 of 2 quests");
    expect(screen.getByText("Ship the report")).toBeVisible();
    expect(screen.queryByText("Walk the dog")).not.toBeInTheDocument();
  });

  it("combines tag and priority chips with AND semantics", () => {
    seedTasks([
      makeTask({ id: "a", title: "Deep work block", tags: ["work"], priority: "high" }),
      makeTask({ id: "b", title: "Inbox sweep", tags: ["work"], priority: "low" }),
      makeTask({ id: "c", title: "Karate class", tags: ["health"], priority: "high" })
    ]);

    render(<QuestLog />);

    fireEvent.click(within(screen.getByRole("group", { name: "Filter by tag" })).getByRole("button", { name: "work" }));
    fireEvent.click(
      within(screen.getByRole("group", { name: "Filter by priority" })).getByRole("button", {
        name: "high"
      })
    );

    expect(screen.getByRole("status")).toHaveTextContent("1 of 3 quests");
    expect(screen.getByText("Deep work block")).toBeVisible();
    expect(screen.queryByText("Inbox sweep")).not.toBeInTheDocument();
    expect(screen.queryByText("Karate class")).not.toBeInTheDocument();
  });

  it("persists a checklist toggle to storage", () => {
    seedTasks([
      makeTask({
        id: "steps",
        title: "Stepped quest",
        checklist: [{ id: "c1", text: "First step", done: false }]
      })
    ]);

    render(<QuestLog />);

    fireEvent.click(screen.getByLabelText("First step"));

    const stored = storedTasks().find((t) => t.id === "steps");
    expect(stored?.checklist).toEqual([{ id: "c1", text: "First step", done: true }]);
  });

  it("shows tasks appended by an external writer and never clobbers them on save", () => {
    seedTasks([makeTask({ id: "mine", title: "My quest" })]);

    render(<QuestLog />);

    // Simulate the coach suggestions panel accepting a quest: it writes
    // through the shared repository, whose save dispatches the
    // data-changed event QuestLog subscribes to.
    act(() => {
      const repository = createLocalTaskRepository(window.localStorage);
      repository.save([
        makeTask({ id: "coach", title: "Coach-suggested quest", tags: ["health"] }),
        ...repository.load()
      ]);
    });

    expect(screen.getByText("Coach-suggested quest")).toBeVisible();

    // A QuestLog mutation after the external add must keep the coach task.
    fireEvent.click(
      within(screen.getByText("My quest").closest("li") as HTMLElement).getByRole("button", {
        name: "Complete"
      })
    );

    expect(storedTasks().map((t) => t.id)).toContain("coach");
    expect(screen.getByText("Coach-suggested quest")).toBeVisible();
    expect(storedTasks().find((t) => t.id === "mine")?.status).toBe("done");
  });

  it("one-tap circle completes through the same flow and fires the boss celebration", () => {
    seedTasks([
      makeTask({
        id: "boss",
        title: "Slay the launch",
        difficulty: "epic",
        recurrence: { frequency: "daily" },
        dueDate: today
      })
    ]);
    const celebrations: CelebrationDetail[] = [];
    const listen = (event: Event) =>
      celebrations.push((event as CustomEvent<CelebrationDetail>).detail);
    window.addEventListener(celebrateEventName, listen);

    render(<QuestLog />);

    fireEvent.click(screen.getByRole("button", { name: "Complete Slay the launch" }));

    window.removeEventListener(celebrateEventName, listen);

    // Same handler path as the Complete action: persists done AND spawns
    // the recurrence's next occurrence.
    const stored = storedTasks();
    expect(stored.find((t) => t.id === "boss")?.status).toBe("done");
    expect(stored.find((t) => t.id !== "boss")).toMatchObject({
      title: "Slay the launch",
      status: "todo",
      difficulty: "epic"
    });

    expect(celebrations).toEqual([
      expect.objectContaining({ kind: "boss", title: "BOSS QUEST CLEARED — +4 XP" })
    ]);
  });

  it("completing a recurring quest spawns and persists the next occurrence", () => {
    seedTasks([
      makeTask({
        id: "daily",
        title: "Daily mobility",
        dueDate: today,
        recurrence: { frequency: "daily" }
      })
    ]);

    render(<QuestLog />);

    fireEvent.click(screen.getByRole("button", { name: "Complete" }));

    const stored = storedTasks();
    const completed = stored.find((t) => t.id === "daily");
    const spawned = stored.find((t) => t.id !== "daily");

    expect(completed?.status).toBe("done");
    expect(spawned).toMatchObject({
      title: "Daily mobility",
      status: "todo",
      dueDate: shiftDate(1),
      recurrence: { frequency: "daily" }
    });

    // The next occurrence is on the board (tomorrow -> Upcoming).
    expect(
      within(screen.getByRole("region", { name: "Upcoming" })).getByText("Daily mobility")
    ).toBeVisible();
  });
});
