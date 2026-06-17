import { describe, expect, it } from "vitest";

import { confirmHealthImport, parseHealthImportText } from "@/domain/healthImport";

const now = "2026-06-16T12:00:00.000Z";

describe("Google Health sleep import", () => {
  it("parses a Google Takeout daily CSV with sleep duration in milliseconds", () => {
    // 28,800,000 ms = 8 hours.
    const csv = ["Date,Steps,Sleeping duration (ms)", "2026-06-15,8200,28800000"].join("\n");
    const { batch, records } = parseHealthImportText("Daily activity metrics.csv", csv, now);

    expect(batch.status).toBe("previewed");
    const sleep = records.find((record) => record.sourceType === "sleep");
    expect(sleep?.value).toBe(8);

    const result = confirmHealthImport(records, [], now);
    const entry = result.entries.find((metric) => metric.sleepHours !== undefined);
    expect(entry?.sleepHours).toBe(8);
    expect(entry?.date).toBe("2026-06-15");
  });

  it("derives sleep hours from a session export with start/end timestamps", () => {
    const json = JSON.stringify([
      { startTime: "2026-06-14T23:00:00.000Z", endTime: "2026-06-15T07:30:00.000Z", stage: "sleeping" }
    ]);
    const { records } = parseHealthImportText("sleep-sessions.json", json, now);

    const sleep = records.find((record) => record.sourceType === "sleep");
    expect(sleep?.value).toBe(8.5);
  });

  it("still handles Samsung-style minutes", () => {
    const csv = ["start_time,sleep_minutes", "2026-06-15T23:00:00Z,480"].join("\n");
    const { records } = parseHealthImportText("samsung_sleep.csv", csv, now);
    expect(records.find((r) => r.sourceType === "sleep")?.value).toBe(8);
  });
});
