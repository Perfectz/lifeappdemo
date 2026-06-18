import { describe, expect, it } from "vitest";

import type { MetricEntry } from "@/domain";
import {
  getVitalsReadings,
  getVitalsTrend,
  latestBloodPressure,
  latestGlucose,
  latestWeight
} from "@/domain/vitals";

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

  it("returns the latest glucose with a fasting band", () => {
    const readings = [
      entry({ id: "g1", recordedAt: "2026-06-16T07:00:00.000Z", bloodGlucoseMgDl: 92, glucoseContext: "fasting" }),
      entry({ id: "g2", recordedAt: "2026-06-17T07:00:00.000Z", bloodGlucoseMgDl: 110, glucoseContext: "fasting" })
    ];
    expect(latestGlucose(readings)).toMatchObject({ mgDl: 110, context: "fasting", band: "prediabetes" });
  });

  it("omits the glucose band for non-fasting readings", () => {
    const reading = entry({ bloodGlucoseMgDl: 140, glucoseContext: "post_meal" });
    expect(latestGlucose([reading])?.band).toBeUndefined();
  });

  it("includes glucose-only entries in the readings list", () => {
    const reading = entry({ id: "g", bloodGlucoseMgDl: 99 });
    expect(getVitalsReadings([reading]).map((r) => r.id)).toEqual(["g"]);
  });

  it("handles no readings", () => {
    expect(latestBloodPressure([])).toBeUndefined();
    expect(latestWeight([])).toBeUndefined();
    expect(latestGlucose([])).toBeUndefined();
    expect(getVitalsReadings([])).toEqual([]);
  });

  it("buckets a vitals trend with per-day latest values and averages", () => {
    const readings = [
      entry({ id: "t1", recordedAt: "2026-06-16T08:00:00.000Z", date: "2026-06-16", bloodGlucoseMgDl: 90, bloodPressureSystolic: 120, bloodPressureDiastolic: 80, weightLbs: 185 }),
      entry({ id: "t2", recordedAt: "2026-06-17T08:00:00.000Z", date: "2026-06-17", bloodGlucoseMgDl: 100, bloodPressureSystolic: 124, bloodPressureDiastolic: 82, weightLbs: 184 }),
      entry({ id: "t3", recordedAt: "2026-06-17T06:00:00.000Z", date: "2026-06-17", bloodGlucoseMgDl: 200 })
    ];
    const trend = getVitalsTrend(readings, "2026-06-17", 7);
    expect(trend.points).toHaveLength(7);
    const todayPoint = trend.points[trend.points.length - 1];
    expect(todayPoint.date).toBe("2026-06-17");
    expect(todayPoint.glucose).toBe(100); // latest reading of the day wins over the earlier 200
    expect(todayPoint.weightLbs).toBe(184);
    expect(trend.avgGlucose).toBe(95);
    expect(trend.avgSystolic).toBe(122);
  });
});
