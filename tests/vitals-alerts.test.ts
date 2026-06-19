import { describe, expect, it } from "vitest";

import type { MetricEntry } from "@/domain";
import { getVitalsAlerts } from "@/domain/vitalsAlerts";

function entry(overrides: Partial<MetricEntry>): MetricEntry {
  const recordedAt = overrides.recordedAt ?? "2026-06-18T08:00:00.000Z";
  return {
    id: overrides.id ?? `m-${recordedAt}`,
    date: overrides.date ?? recordedAt.slice(0, 10),
    checkInType: "morning",
    source: "manual",
    recordedAt,
    createdAt: recordedAt,
    updatedAt: recordedAt,
    ...overrides
  };
}

describe("vitals alerts", () => {
  it("escalates a hypertensive-crisis reading as critical", () => {
    const alerts = getVitalsAlerts([
      entry({ bloodPressureSystolic: 212, bloodPressureDiastolic: 130 })
    ]);
    const bp = alerts.find((alert) => alert.id === "bp-crisis");
    expect(bp?.severity).toBe("critical");
    expect(bp?.title).toContain("212/130");
  });

  it("warns on stage-2 blood pressure", () => {
    const alerts = getVitalsAlerts([
      entry({ bloodPressureSystolic: 150, bloodPressureDiastolic: 95 })
    ]);
    expect(alerts.find((alert) => alert.id === "bp-stage-2")?.severity).toBe("warning");
  });

  it("flags very high and very low glucose as critical", () => {
    expect(getVitalsAlerts([entry({ bloodGlucoseMgDl: 260 })])[0]?.severity).toBe("critical");
    expect(getVitalsAlerts([entry({ bloodGlucoseMgDl: 48 })])[0]?.id).toBe("glucose-very-low");
  });

  it("stays silent for in-range vitals", () => {
    const alerts = getVitalsAlerts([
      entry({
        bloodPressureSystolic: 118,
        bloodPressureDiastolic: 76,
        bloodGlucoseMgDl: 92,
        glucoseContext: "fasting"
      })
    ]);
    expect(alerts).toEqual([]);
  });

  it("uses the most recent reading", () => {
    const alerts = getVitalsAlerts([
      entry({ id: "old", recordedAt: "2026-06-17T08:00:00.000Z", bloodPressureSystolic: 200, bloodPressureDiastolic: 130 }),
      entry({ id: "new", recordedAt: "2026-06-18T08:00:00.000Z", bloodPressureSystolic: 118, bloodPressureDiastolic: 76 })
    ]);
    expect(alerts.find((alert) => alert.id?.startsWith("bp"))).toBeUndefined();
  });
});
