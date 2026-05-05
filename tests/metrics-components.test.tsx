import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { healthBoundaryCopy, MetricsCheckIn } from "@/components/MetricsCheckIn";
import { metricStorageKey } from "@/data/metricRepository";
import type { MetricEntry } from "@/domain";

const now = "2026-05-04T08:00:00.000Z";

function makeEntry(overrides: Partial<MetricEntry> = {}): MetricEntry {
  return {
    id: "metric-1",
    date: "2026-05-04",
    checkInType: "morning",
    source: "manual",
    energyLevel: 4,
    moodLevel: 3,
    sleepHours: 7,
    steps: 5000,
    recordedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("MetricsCheckIn", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("saves valid metric data", async () => {
    render(<MetricsCheckIn />);

    fireEvent.change(screen.getByLabelText("Check-in type"), {
      target: { value: "evening" }
    });
    fireEvent.change(screen.getByLabelText("Energy level"), {
      target: { value: "4" }
    });
    fireEvent.change(screen.getByLabelText("Mood level"), {
      target: { value: "3" }
    });
    fireEvent.change(screen.getByLabelText("Steps"), {
      target: { value: "6400" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Metrics" }));

    await waitFor(() => {
      expect(screen.getByText("Metric check-in saved.")).toBeVisible();
    });

    const raw = window.localStorage.getItem(metricStorageKey);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw ?? "[]")[0]).toMatchObject({
      checkInType: "evening",
      energyLevel: 4,
      moodLevel: 3,
      steps: 6400
    });
  });

  it("displays validation errors without saving invalid data", async () => {
    render(<MetricsCheckIn />);

    fireEvent.change(screen.getByLabelText("Steps"), {
      target: { value: "-1" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Metrics" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Steps must be a non-negative whole number."
      );
    });
    expect(JSON.parse(window.localStorage.getItem(metricStorageKey) ?? "[]")).toHaveLength(0);
  });

  it("renders recent entries and the health boundary", async () => {
    window.localStorage.setItem(
      metricStorageKey,
      JSON.stringify([makeEntry({ id: "metric-1", workoutSummary: "Walked." })])
    );

    render(<MetricsCheckIn />);

    await waitFor(() => {
      expect(screen.getByText("2026-05-04 - morning")).toBeVisible();
    });
    expect(screen.getByText("Energy 4 | Mood 3 | Sleep 7h | 5000 steps")).toBeVisible();
    expect(screen.getByText("Walked.")).toBeVisible();
    expect(screen.getByText(healthBoundaryCopy)).toBeVisible();
  });
});
