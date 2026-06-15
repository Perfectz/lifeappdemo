import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { DailyFitness } from "@/components/DailyFitness";
import { workoutStorageKey } from "@/data/workoutRepository";

describe("DailyFitness", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts with no sessions logged", async () => {
    render(<DailyFitness />);
    await waitFor(() => {
      expect(screen.getByText("0/3")).toBeVisible();
    });
    expect(screen.getByRole("button", { name: "Log strength" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Log cardio" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Log martial arts" })).toBeVisible();
  });

  it("logs all three sessions and completes the day", async () => {
    render(<DailyFitness />);

    fireEvent.click(screen.getByRole("button", { name: "Log strength" }));
    await waitFor(() => expect(screen.getByText("1/3")).toBeVisible());

    fireEvent.click(screen.getByRole("button", { name: "Log cardio" }));
    await waitFor(() => expect(screen.getByText("2/3")).toBeVisible());

    fireEvent.click(screen.getByRole("button", { name: "Log martial arts" }));
    await waitFor(() => expect(screen.getByText("3/3")).toBeVisible());

    expect(
      screen.getByText("✓ Day complete — all three sessions logged.")
    ).toBeVisible();

    const stored = JSON.parse(window.localStorage.getItem(workoutStorageKey) ?? "[]");
    expect(stored).toHaveLength(3);
    expect(stored.map((w: { type: string }) => w.type).sort()).toEqual([
      "cardio",
      "martial_arts",
      "strength"
    ]);
  });

  it("captures per-exercise weight on a strength log", async () => {
    render(<DailyFitness />);

    const weightInputs = screen.getAllByLabelText("Weight (lb)");
    fireEvent.change(weightInputs[0], { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: "Log strength" }));

    await waitFor(() => expect(screen.getByText("1/3")).toBeVisible());

    const stored = JSON.parse(window.localStorage.getItem(workoutStorageKey) ?? "[]");
    const strength = stored.find((w: { type: string }) => w.type === "strength");
    expect(strength.sets[0].weightLbs).toBe(40);
  });

  it("captures weight-vest load on a cardio log", async () => {
    render(<DailyFitness />);

    fireEvent.change(screen.getByLabelText("Weight vest (lb) — optional"), {
      target: { value: "20" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Log cardio" }));

    await waitFor(() => expect(screen.getByText("1/3")).toBeVisible());

    const stored = JSON.parse(window.localStorage.getItem(workoutStorageKey) ?? "[]");
    const cardio = stored.find((w: { type: string }) => w.type === "cardio");
    expect(cardio.weightVestLbs).toBe(20);
  });

  it("removes a logged session", async () => {
    render(<DailyFitness />);

    fireEvent.click(screen.getByRole("button", { name: "Log cardio" }));
    await waitFor(() => expect(screen.getByText("1/3")).toBeVisible());

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(screen.getByText("0/3")).toBeVisible());

    expect(JSON.parse(window.localStorage.getItem(workoutStorageKey) ?? "[]")).toHaveLength(0);
  });
});
