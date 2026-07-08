import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { DailyFitness } from "@/components/DailyFitness";
import { TrainingProfilePanel } from "@/components/TrainingProfilePanel";
import { workoutStorageKey } from "@/data/workoutRepository";
import { loadTrainingProfile } from "@/data/trainingProfileRepository";

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

    const goodDay = screen.getByText(/Good day/);
    expect(goodDay).toBeVisible();
    expect(goodDay).toHaveTextContent(/all three/);

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

  it("captures distance on a cardio log", async () => {
    render(<DailyFitness />);

    fireEvent.change(screen.getByLabelText("Distance (mi) — optional"), {
      target: { value: "2.5" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Log cardio" }));

    await waitFor(() => expect(screen.getByText("1/3")).toBeVisible());

    const stored = JSON.parse(window.localStorage.getItem(workoutStorageKey) ?? "[]");
    const cardio = stored.find((w: { type: string }) => w.type === "cardio");
    expect(cardio.distanceMiles).toBe(2.5);
  });

  it("removes a logged session", async () => {
    render(<DailyFitness />);

    fireEvent.click(screen.getByRole("button", { name: "Log cardio" }));
    await waitFor(() => expect(screen.getByText("1/3")).toBeVisible());

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(screen.getByText("0/3")).toBeVisible());

    expect(JSON.parse(window.localStorage.getItem(workoutStorageKey) ?? "[]")).toHaveLength(0);
  });

  it("logs the coach prescription through the prefilled editor", async () => {
    render(<DailyFitness />);

    // The offline fallback plan carries real prescriptions.
    const logPrescribed = await screen.findByRole("button", { name: "Log as prescribed" });
    fireEvent.click(logPrescribed);

    // Prefilled editor appears — adjust the first weight, then save.
    const weightInputs = screen.getAllByLabelText("Weight (lb)", { selector: "input" });
    fireEvent.change(weightInputs[0], { target: { value: "135" } });
    fireEvent.click(screen.getByRole("button", { name: "Save session" }));

    await waitFor(() => expect(screen.getByText("1/3")).toBeVisible());

    const stored = JSON.parse(window.localStorage.getItem(workoutStorageKey) ?? "[]");
    const strength = stored.find((w: { type: string }) => w.type === "strength");
    expect(strength.source).toBe("ai");
    expect(strength.sets.length).toBeGreaterThanOrEqual(3);
    expect(strength.sets[0].reps).toBeGreaterThan(0);
    expect(strength.sets[0].weightLbs).toBe(135);
  });

  it("scrolls to a previous day and logs onto that day, not today", async () => {
    render(<DailyFitness />);
    await waitFor(() => expect(screen.getByText("0/3")).toBeVisible());

    fireEvent.click(screen.getByRole("button", { name: "Previous day" }));
    // Now viewing a past day — a way back to today appears.
    expect(screen.getByRole("button", { name: "Jump to today" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Log cardio" }));
    await waitFor(() => expect(screen.getByText("1/3")).toBeVisible());

    // Back on today, that session should NOT count — it was logged to the past day.
    fireEvent.click(screen.getByRole("button", { name: "Jump to today" }));
    await waitFor(() => expect(screen.getByText("0/3")).toBeVisible());
  });
});

describe("TrainingProfilePanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the seeded defaults", async () => {
    render(<TrainingProfilePanel />);
    await waitFor(() => expect(screen.getByText("Training profile")).toBeVisible());
    expect(screen.getByLabelText("Kettlebells")).toBeChecked();
    expect(screen.getByLabelText("Dumbbells")).toBeChecked();
    expect(screen.getByLabelText("Resistance bands")).toBeChecked();
    expect(screen.getByLabelText("Pull-up bar")).not.toBeChecked();
    expect(screen.getByLabelText("Commercial gym access (barbells + machines)")).toBeChecked();
    expect(screen.getByLabelText("Coach style")).toHaveValue("vinny_split");
  });

  it("persists equipment toggles and notes immediately", async () => {
    render(<TrainingProfilePanel />);
    const gym = await screen.findByLabelText("Commercial gym access (barbells + machines)");
    fireEvent.click(gym);
    expect(loadTrainingProfile(window.localStorage).gymAccess).toBe(false);

    const notes = screen.getByLabelText("Notes for the coach — optional");
    fireEvent.change(notes, { target: { value: "karate Tue/Thu" } });
    fireEvent.blur(notes);
    expect(loadTrainingProfile(window.localStorage).notes).toBe("karate Tue/Thu");
  });
});
