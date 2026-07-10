import { render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { Dashboard } from "@/components/Dashboard";
import { dailyNutritionTargetStorageKey } from "@/data/dailyNutritionTargetRepository";
import { dailyPlanStorageKey } from "@/data/dailyPlanRepository";
import { foodEntryStorageKey } from "@/data/foodEntryRepository";
import { metricStorageKey } from "@/data/metricRepository";
import { taskStorageKey } from "@/data/taskRepository";
import { workoutStorageKey } from "@/data/workoutRepository";
import { bodyProfileStorageKey } from "@/data/bodyProfileRepository";
import type { DailyPlan, FoodEntry, MetricEntry, Task, Workout } from "@/domain";
import type { DailyNutritionTarget } from "@/domain/dailyNutritionTarget";

function todayIsoDate(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
}

function makeWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: "workout-1",
    date: todayIsoDate(),
    type: "strength",
    title: "Kettlebell strength A",
    source: "manual",
    recordedAt: "2026-05-04T10:00:00.000Z",
    createdAt: "2026-05-04T10:00:00.000Z",
    updatedAt: "2026-05-04T10:00:00.000Z",
    ...overrides
  };
}

function makeFoodEntry(overrides: Partial<FoodEntry> = {}): FoodEntry {
  return {
    id: "food-1",
    date: todayIsoDate(),
    mealType: "lunch",
    description: "Chicken bowl",
    macros: { calories: 650, proteinG: 45, carbsG: 60, fatG: 20 },
    estimateSource: "manual",
    recordedAt: "2026-05-04T12:00:00.000Z",
    createdAt: "2026-05-04T12:00:00.000Z",
    updatedAt: "2026-05-04T12:00:00.000Z",
    ...overrides
  };
}

function makeNutritionTarget(overrides: Partial<DailyNutritionTarget> = {}): DailyNutritionTarget {
  return {
    date: todayIsoDate(),
    calorieTarget: 2000,
    proteinTargetG: 150,
    carbsTargetG: 200,
    fatTargetG: 60,
    rationale: "Test target.",
    source: "manual",
    createdAt: "2026-05-04T06:00:00.000Z",
    ...overrides
  };
}

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

function completeSetup() {
  window.localStorage.setItem(
    bodyProfileStorageKey,
    JSON.stringify({ setupCompleted: true, updatedAt: "2026-05-04T08:00:00.000Z" })
  );
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
    // The stat-tile row was removed; the backlog surfaces as a quiet link
    // under the Planned Quests header instead.
    expect(screen.getByRole("link", { name: "1 in backlog →" })).toBeVisible();
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
    // Sleep "7h" appears in both the snapshot and the North Star card — scope to the snapshot.
    const snapshot = document.querySelector(".metric-snapshot") as HTMLElement;
    expect(within(snapshot).getByText("7h")).toBeVisible();
    expect(screen.getByText("6500")).toBeVisible();
  });

  it("renders the health row above the planned quests section", async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Choose your training rhythm" })).toBeVisible();
    });
    expect(screen.queryByText(/behind on training/i)).not.toBeInTheDocument();

    const healthRow = document.querySelector(".dashboard-health-row");
    const questsLayout = document.querySelector(".dashboard-layout");
    expect(healthRow).not.toBeNull();
    expect(questsLayout).not.toBeNull();
    // The quests layout must come AFTER the health row in document order.
    expect(
      healthRow!.compareDocumentPosition(questsLayout!) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});

describe("TodayTrainingCard (via Dashboard)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    completeSetup();
  });

  it("shows the three training buckets with logged workouts marked done", async () => {
    window.localStorage.setItem(
      workoutStorageKey,
      JSON.stringify([makeWorkout({ id: "w1", type: "strength", title: "Kettlebell strength A" })])
    );

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Today's Training — 1/3" })).toBeVisible();
    });

    const card = document.querySelector(".training-card") as HTMLElement;
    expect(within(card).getByText("Strength")).toBeVisible();
    expect(within(card).getByText("Cardio")).toBeVisible();
    expect(within(card).getByText("Martial Arts")).toBeVisible();
    expect(within(card).getByText("Kettlebell strength A ✓")).toBeVisible();
    expect(within(card).getAllByText("not yet")).toHaveLength(2);
    expect(within(card).getByRole("link", { name: /Open Training/ })).toHaveAttribute(
      "href",
      "/fitness"
    );
  });

  it("counts a karate-class check-in as a completed martial arts slot", async () => {
    window.localStorage.setItem(
      metricStorageKey,
      JSON.stringify([makeMetricEntry({ date: todayIsoDate(), karateClass: true })])
    );

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Today's Training — 1/3" })).toBeVisible();
    });

    const card = document.querySelector(".training-card") as HTMLElement;
    expect(within(card).getByText("Karate class ✓")).toBeVisible();
    expect(within(card).getAllByText("not yet")).toHaveLength(2);
  });

  it("shows an encouraging one-liner when nothing is logged yet", async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Today's Training — 0/3" })).toBeVisible();
    });
    expect(
      screen.getByText("Fresh log today — one session puts your first slot on the board.")
    ).toBeVisible();
  });
});

describe("FuelCard (via Dashboard)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows today's totals against the stored daily target", async () => {
    window.localStorage.setItem(foodEntryStorageKey, JSON.stringify([makeFoodEntry()]));
    window.localStorage.setItem(
      dailyNutritionTargetStorageKey,
      JSON.stringify([makeNutritionTarget()])
    );

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("650 / 2000 kcal")).toBeVisible();
    });

    const card = document.querySelector(".fuel-card") as HTMLElement;
    expect(within(card).getByText("Protein")).toBeVisible();
    expect(within(card).getByText("45 / 150 g")).toBeVisible();
    expect(within(card).getByText("60 / 200 g")).toBeVisible();
    expect(within(card).getByText("20 / 60 g")).toBeVisible();
    expect(within(card).getByRole("link", { name: /Open Nutrition/ })).toHaveAttribute(
      "href",
      "/nutrition"
    );
    // Under target: the meter keeps the default fill.
    expect(card.querySelector(".fuel-meter")).not.toBeNull();
    expect(card.querySelector(".fuel-meter-over")).toBeNull();
  });

  it("tints the meter with the warning tone when over target", async () => {
    window.localStorage.setItem(
      foodEntryStorageKey,
      JSON.stringify([makeFoodEntry({ macros: { calories: 2400, proteinG: 90, carbsG: 250, fatG: 80 } })])
    );
    window.localStorage.setItem(
      dailyNutritionTargetStorageKey,
      JSON.stringify([makeNutritionTarget()])
    );

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("2400 / 2000 kcal")).toBeVisible();
    });

    const card = document.querySelector(".fuel-card") as HTMLElement;
    expect(card.querySelector(".fuel-meter-over")).not.toBeNull();
    expect(within(card).getByText("over target")).toBeVisible();
  });

  it("nudges toward setting a calorie goal when no target is stored", async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("No calorie goal for today yet.")).toBeVisible();
    });
    expect(screen.getByRole("link", { name: /Set your calorie goal/ })).toHaveAttribute(
      "href",
      "/nutrition"
    );
  });
});
