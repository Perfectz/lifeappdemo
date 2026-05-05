import { describe, expect, it } from "vitest";

import type { MetricEntry } from "@/domain";
import {
  buildHealthImportPreview,
  confirmHealthImport,
  isDuplicateImportedMetric,
  metricEntryFromImportedRecord,
  parseHealthImportText
} from "@/domain/healthImport";

const now = "2026-05-05T12:00:00.000Z";

describe("health import parser and normalizer", () => {
  it("parses a valid steps CSV fixture", () => {
    const result = parseHealthImportText(
      "com.samsung.health.step_count.csv",
      "start_time,steps\n2026-05-05T08:00:00-04:00,8421",
      now
    );

    expect(result.batch.status).toBe("previewed");
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      sourceType: "steps",
      value: 8421,
      startTime: "2026-05-05T12:00:00.000Z"
    });
  });

  it("parses a valid sleep JSON fixture", () => {
    const result = parseHealthImportText(
      "sleep.json",
      JSON.stringify([{ date: "2026-05-05", sleep_minutes: 450 }]),
      now
    );

    expect(result.records[0]).toMatchObject({
      sourceType: "sleep",
      value: 7.5
    });
  });

  it("fails safely for invalid or missing-header fixtures", () => {
    const result = parseHealthImportText("bad.csv", "not enough data", now);

    expect(result.batch.status).toBe("failed");
    expect(result.batch.errors[0]).toContain("header row");
    expect(result.records).toEqual([]);
  });

  it("normalizes supported records to MetricEntry fields", () => {
    const parsed = parseHealthImportText(
      "steps.csv",
      "start_time,steps\n2026-05-05T09:00:00Z,1000",
      now
    );
    const entry = metricEntryFromImportedRecord(parsed.records[0], now);

    expect(entry).toMatchObject({
      date: "2026-05-05",
      checkInType: "freeform",
      source: "samsung_export",
      steps: 1000,
      recordedAt: "2026-05-05T09:00:00.000Z"
    });
  });

  it("detects duplicate source, time, and value matches", () => {
    const parsed = parseHealthImportText(
      "steps.csv",
      "start_time,steps\n2026-05-05T09:00:00Z,1000",
      now
    );
    const entry = metricEntryFromImportedRecord(parsed.records[0], now) as MetricEntry;

    expect(isDuplicateImportedMetric(entry, [entry])).toBe(true);
    expect(buildHealthImportPreview(parsed.records, [entry])[0].duplicate).toBe(true);
    expect(confirmHealthImport(parsed.records, [entry], now)).toMatchObject({
      importedCount: 0,
      duplicateCount: 1,
      ignoredCount: 0
    });
  });
});
