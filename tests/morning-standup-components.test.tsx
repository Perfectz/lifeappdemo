import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { MorningStandup } from "@/components/MorningStandup";
import { dailyPlanStorageKey } from "@/data/dailyPlanRepository";
import { metricStorageKey } from "@/data/metricRepository";
import { toLocalIsoDate } from "@/domain/dates";

describe("MorningStandup", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the three morning steps", async () => {
    render(<MorningStandup />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Good morning/i })).toBeVisible();
    });
    expect(screen.getByText("Log this morning's vitals")).toBeVisible();
    expect(screen.getByText(/Today's training/)).toBeVisible();
    expect(screen.getByText("Set today's intention")).toBeVisible();
  });

  it("logs morning vitals to the metric store, then collapses to a summary", async () => {
    render(<MorningStandup />);

    fireEvent.change(screen.getByLabelText(/Glucose/i), { target: { value: "96" } });
    fireEvent.change(screen.getByLabelText(/Systolic/i), { target: { value: "122" } });
    fireEvent.change(screen.getByLabelText(/Diastolic/i), { target: { value: "78" } });
    fireEvent.change(screen.getByLabelText(/Weight/i), { target: { value: "228" } });
    fireEvent.click(screen.getByRole("button", { name: "Log vitals" }));

    await waitFor(() =>
      expect(screen.getByText(/Morning vitals logged/i)).toBeVisible()
    );

    const stored = JSON.parse(window.localStorage.getItem(metricStorageKey) ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      bloodGlucoseMgDl: 96,
      bloodPressureSystolic: 122,
      bloodPressureDiastolic: 78,
      weightLbs: 228,
      checkInType: "morning"
    });

    // Once logged, the form gives way to the compact summary.
    await waitFor(() =>
      expect(
        screen.getByText(/Vitals logged ✓/)
      ).toBeVisible()
    );
    expect(screen.getByText(/glucose 96 mg\/dL · BP 122\/78 · weight 228 lb/)).toBeVisible();
    expect(screen.queryByLabelText(/Glucose/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Log vitals" })).not.toBeInTheDocument();
  });

  it("shows the vitals form when nothing is logged yet today", async () => {
    render(<MorningStandup />);
    await waitFor(() => expect(screen.getByText(/No vitals logged yet today/i)).toBeVisible());
    expect(screen.getByLabelText(/Glucose/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Log vitals" })).toBeVisible();
    expect(screen.queryByText(/Vitals logged ✓/)).not.toBeInTheDocument();
  });

  it("shows a compact summary instead of the form when today's vitals exist", async () => {
    const now = new Date().toISOString();
    const isoDate = toLocalIsoDate();
    window.localStorage.setItem(
      metricStorageKey,
      JSON.stringify([
        {
          id: "metric-today",
          date: isoDate,
          checkInType: "morning",
          source: "manual",
          bloodGlucoseMgDl: 101,
          bloodPressureSystolic: 118,
          bloodPressureDiastolic: 76,
          weightLbs: 226,
          recordedAt: now,
          createdAt: now,
          updatedAt: now
        }
      ])
    );

    render(<MorningStandup />);

    await waitFor(() => expect(screen.getByText(/Vitals logged ✓/)).toBeVisible());
    expect(screen.getByText(/glucose 101 mg\/dL · BP 118\/76 · weight 226 lb/)).toBeVisible();
    expect(screen.queryByLabelText(/Glucose/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Log vitals" })).not.toBeInTheDocument();
  });

  it("requires at least one vitals value", async () => {
    render(<MorningStandup />);
    fireEvent.click(screen.getByRole("button", { name: "Log vitals" }));

    await waitFor(() =>
      expect(screen.getByText(/Enter a glucose, blood pressure, or weight value/i)).toBeVisible()
    );
    expect(JSON.parse(window.localStorage.getItem(metricStorageKey) ?? "[]")).toHaveLength(0);
  });

  it("saves a daily intention to the plan store", async () => {
    render(<MorningStandup />);

    fireEvent.change(screen.getByPlaceholderText(/anchor the day/i), {
      target: { value: "Walk before the first meeting." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save intention" }));

    await waitFor(() => expect(screen.getByText(/Intention saved/i)).toBeVisible());

    const stored = JSON.parse(window.localStorage.getItem(dailyPlanStorageKey) ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].intention).toBe("Walk before the first meeting.");
  });
});
