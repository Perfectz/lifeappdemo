import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { WaterTracker } from "@/components/WaterTracker";
import { waterStorageKey } from "@/data/waterRepository";
import type { WaterEntry } from "@/domain/waterTracking";

const DAY = "2026-07-08";

function storedEntries(): WaterEntry[] {
  return JSON.parse(window.localStorage.getItem(waterStorageKey) ?? "[]") as WaterEntry[];
}

describe("WaterTracker", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("logs quick amounts and reflects the running total", async () => {
    render(<WaterTracker date={DAY} />);

    expect(screen.getByRole("progressbar", { name: "Water progress" })).toHaveAttribute(
      "aria-valuenow",
      "0"
    );

    fireEvent.click(screen.getByRole("button", { name: "+8 oz" }));
    fireEvent.click(screen.getByRole("button", { name: "+16 oz" }));

    await waitFor(() =>
      expect(screen.getByRole("progressbar", { name: "Water progress" })).toHaveAttribute(
        "aria-valuenow",
        "24"
      )
    );
    expect(screen.getByText("24")).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "Water progress" })).toHaveAttribute(
      "aria-valuemax",
      "64"
    );

    const entries = storedEntries();
    expect(entries).toHaveLength(2);
    expect(entries.every((entry) => entry.date === DAY)).toBe(true);
  });

  it("undoes the last pour and disables undo when the day is empty", async () => {
    render(<WaterTracker date={DAY} />);

    const undo = screen.getByRole("button", { name: "Undo last water entry" });
    expect(undo).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "+8 oz" }));
    fireEvent.click(screen.getByRole("button", { name: "+16 oz" }));
    await waitFor(() => expect(undo).toBeEnabled());

    fireEvent.click(undo);
    await waitFor(() =>
      expect(screen.getByRole("progressbar", { name: "Water progress" })).toHaveAttribute(
        "aria-valuenow",
        "8"
      )
    );
    expect(storedEntries()).toHaveLength(1);

    fireEvent.click(undo);
    await waitFor(() => expect(undo).toBeDisabled());
    expect(storedEntries()).toHaveLength(0);
  });

  it("only counts the viewed date", async () => {
    window.localStorage.setItem(
      waterStorageKey,
      JSON.stringify([
        { id: "w1", date: "2026-07-07", oz: 32, recordedAt: "2026-07-07T10:00:00.000Z" },
        { id: "w2", date: DAY, oz: 8, recordedAt: "2026-07-08T09:00:00.000Z" }
      ])
    );

    render(<WaterTracker date={DAY} />);

    await waitFor(() =>
      expect(screen.getByRole("progressbar", { name: "Water progress" })).toHaveAttribute(
        "aria-valuenow",
        "8"
      )
    );
  });
});
