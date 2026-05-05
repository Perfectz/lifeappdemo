import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { Dashboard } from "@/components/Dashboard";
import { DemoModePanel } from "@/components/DemoModePanel";
import { dailyPlanStorageKey } from "@/data/dailyPlanRepository";
import { dailyReportStorageKey } from "@/data/dailyReportRepository";
import { eveningPostmortemStorageKey } from "@/data/eveningPostmortemRepository";
import { journalStorageKey } from "@/data/journalRepository";
import { metricStorageKey } from "@/data/metricRepository";
import { taskStorageKey } from "@/data/taskRepository";
import { createDemoDataSet, demoModeStorageKey } from "@/domain/demoData";
import { toLocalIsoDate } from "@/domain/dates";

describe("demo mode components", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders a demo badge after demo mode is enabled", async () => {
    render(<DemoModePanel />);

    fireEvent.click(screen.getByRole("button", { name: "Enable Demo Mode" }));

    await waitFor(() => {
      expect(screen.getByText("Demo Data")).toBeVisible();
    });
    expect(window.localStorage.getItem(demoModeStorageKey)).toBe("enabled");
    expect(JSON.parse(window.localStorage.getItem(metricStorageKey) ?? "[]")[0].source).toBe("demo");
  });

  it("dashboard handles populated demo state", async () => {
    const demoData = createDemoDataSet(toLocalIsoDate(), "2026-05-05T12:00:00.000Z");
    window.localStorage.setItem(taskStorageKey, JSON.stringify(demoData.tasks));
    window.localStorage.setItem(dailyPlanStorageKey, JSON.stringify(demoData.dailyPlans));
    window.localStorage.setItem(metricStorageKey, JSON.stringify(demoData.metricEntries));
    window.localStorage.setItem(journalStorageKey, JSON.stringify(demoData.journalEntries));
    window.localStorage.setItem(dailyReportStorageKey, JSON.stringify(demoData.dailyReports));
    window.localStorage.setItem(eveningPostmortemStorageKey, JSON.stringify(demoData.eveningPostmortems));
    window.localStorage.setItem(demoModeStorageKey, "enabled");

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText("Screenshot-Ready Demo")).toBeVisible();
    });
    expect(screen.getAllByText("Demo Data").length).toBeGreaterThan(0);
    expect(screen.getByText("Ship the portfolio-ready LifeQuest walkthrough")).toBeVisible();
    expect(screen.getByText("11850")).toBeVisible();
  });
});
