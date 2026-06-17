import { describe, expect, it } from "vitest";

import type { MetricEntry } from "@/domain";
import { getVitalsReadings, latestBloodPressure, latestWeight } from "@/domain/vitals";

function entry(overrides: Partial<MetricEntry>): MetricEntry {
  const recordedAt = overrides.recordedAt ?? "2026-06-17T08:00:00.000Z";
  return {
    id: overrides.id ?? `m-${recordedAt}`,
    date: overrides.date ?? recordedAt.slice(0, 10),
    checkInType: "freeform",
    source: "manual",
    recordedAt,
    createdAt: recordedAt,
    updatedAt: recordedAt,
    ...overrides
  };
}

describe("vitals helpers", () => {
  const entries = [
    entry({ id: "a", recordedAt: "2026-06-15T08:00:00.000Z", weightLbs: 186, bloodPressureSystolic: 128, bloodPressureDiastolic: 82 }),
    entry({ id: "b", recordedAt: "2026-06-16T08:00:00.000Z", weightLbs: 185 }),
    entry({ id: "c", recordedAt: "2026-06-17T08:00:00.000Z", bloodPressureSystolic: 118, bloodPressureDiastolic: 76 }),
    entry({ id: "d", recordedAt: "2026-06-17T09:00:00.000Z", energyLevel: 4 }) // no vitals
  ];

  it("returns only entries with a BP or weight, newest first", () => {
    const readings = getVitalsReadings(entries);
    expect(readings.map((r) => r.id)).toEqual(["c", "b", "a"]);
  });

  it("returns the latest complete blood pressure with an AHA category", () => {
    const bp = latestBloodPressure(entries);
    expect(bp).toMatchObject({ systolic: 118, diastolic: 76, category: "normal" });
  });

  it("returns the latest weight and the change vs the previous weigh-in", () => {
    const weight = latestWeight(entries);
    expect(weight).toMatchObject({ weightLbs: 185, changeLbs: -1 });
  });

  it("handles no readings", () => {
    expect(latestBloodPressure([])).toBeUndefined();
    expect(latestWeight([])).toBeUndefined();
    expect(getVitalsReadings([])).toEqual([]);
  });
});
