import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { HealthImport } from "@/components/HealthImport";
import { metricStorageKey } from "@/data/metricRepository";

function uploadFile(contents: string, fileName = "steps.csv") {
  const file = new File([contents], fileName, { type: "text/csv" });
  fireEvent.change(screen.getByLabelText("Health export file"), {
    target: { files: [file] }
  });
}

describe("HealthImport", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders a dry-run preview for parsed records", async () => {
    render(<HealthImport />);

    uploadFile("start_time,steps\n2026-05-05T09:00:00Z,8000");

    await waitFor(() => {
      expect(screen.getByText("Dry-run preview ready: 1 record(s) parsed.")).toBeVisible();
    });
    expect(screen.getByRole("heading", { name: "steps" })).toBeVisible();
    expect(screen.getByText("Steps -> MetricEntry.steps")).toBeVisible();
    expect(screen.getByText("No match found")).toBeVisible();
  });

  it("confirms an import and stores samsung_export metric entries", async () => {
    render(<HealthImport />);

    uploadFile("start_time,steps\n2026-05-05T09:00:00Z,8000");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Confirm Import" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Import" }));

    await waitFor(() => {
      expect(screen.getByText("Import complete: 1 metric entry saved.")).toBeVisible();
    });
    const entries = JSON.parse(window.localStorage.getItem(metricStorageKey) ?? "[]");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      source: "samsung_export",
      steps: 8000
    });
  });

  it("shows invalid file errors without creating metrics", async () => {
    render(<HealthImport />);

    uploadFile("not enough data", "bad.csv");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("header row");
    });
    expect(JSON.parse(window.localStorage.getItem(metricStorageKey) ?? "[]")).toEqual([]);
  });
});
