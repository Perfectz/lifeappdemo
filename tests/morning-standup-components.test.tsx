import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { MorningStandup } from "@/components/MorningStandup";
import { dailyPlanStorageKey } from "@/data/dailyPlanRepository";
import { metricStorageKey } from "@/data/metricRepository";

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

  it("logs morning vitals to the metric store", async () => {
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
