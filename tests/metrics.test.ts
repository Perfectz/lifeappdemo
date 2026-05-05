import { describe, expect, it } from "vitest";

import type { MetricEntry } from "@/domain";
import {
  createMetricEntry,
  getLatestMetricEntry,
  getRecentMetricEntries,
  isMetricEntry,
  validateMetricInput
} from "@/domain/metrics";

const today = "2026-05-04";
const now = "2026-05-04T08:00:00.000Z";

function makeEntry(overrides: Partial<MetricEntry> = {}): MetricEntry {
  return {
    id: "metric-1",
    date: today,
    checkInType: "morning",
    source: "manual",
    energyLevel: 4,
    moodLevel: 3,
    recordedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("MetricEntry validation", () => {
  it("accepts and normalizes supported metric fields", () => {
    const validation = validateMetricInput({
      date: today,
      checkInType: "morning",
      weightLbs: 201.5,
      sleepHours: 7.25,
      energyLevel: 4,
      moodLevel: 5,
      steps: 6500,
      workoutSummary: " Lifted. ",
      bloodPressureSystolic: 120,
      bloodPressureDiastolic: 80,
      notes: " Good start. "
    });

    expect(validation).toEqual({
      ok: true,
      value: {
        date: today,
        checkInType: "morning",
        weightLbs: 201.5,
        sleepHours: 7.25,
        energyLevel: 4,
        moodLevel: 5,
        steps: 6500,
        workoutSummary: "Lifted.",
        bloodPressureSystolic: 120,
        bloodPressureDiastolic: 80,
        notes: "Good start."
      }
    });
  });

  it("rejects invalid values", () => {
    expect(
      validateMetricInput({ date: today, checkInType: "morning", weightLbs: -1 })
    ).toEqual({ ok: false, message: "Weight must be positive." });

    expect(
      validateMetricInput({ date: today, checkInType: "morning", sleepHours: 25 })
    ).toEqual({ ok: false, message: "Sleep hours must be between 0 and 24." });

    expect(
      validateMetricInput({ date: today, checkInType: "morning", energyLevel: 6 })
    ).toEqual({ ok: false, message: "Energy level must be 1-5." });

    expect(validateMetricInput({ date: today, checkInType: "morning", steps: -10 })).toEqual({
      ok: false,
      message: "Steps must be a non-negative whole number."
    });

    expect(
      validateMetricInput({
        date: today,
        checkInType: "morning",
        bloodPressureSystolic: 0
      })
    ).toEqual({
      ok: false,
      message: "Blood pressure systolic must be a positive whole number."
    });
  });

  it("creates manual metric entries", () => {
    const entry = createMetricEntry(
      {
        date: today,
        checkInType: "evening",
        energyLevel: 2
      },
      now
    );

    expect(entry).toMatchObject({
      date: today,
      checkInType: "evening",
      source: "manual",
      energyLevel: 2,
      recordedAt: now
    });
  });
});

describe("metric selectors and schema guard", () => {
  it("returns the newest metric entry", () => {
    const latest = makeEntry({
      id: "latest",
      recordedAt: "2026-05-04T20:00:00.000Z"
    });

    expect(
      getLatestMetricEntry([
        makeEntry({ id: "old", recordedAt: "2026-05-04T07:00:00.000Z" }),
        latest
      ])
    ).toEqual(latest);
  });

  it("returns recent entries in newest-first order", () => {
    expect(
      getRecentMetricEntries(
        [
          makeEntry({ id: "1", recordedAt: "2026-05-04T08:00:00.000Z" }),
          makeEntry({ id: "2", recordedAt: "2026-05-04T21:00:00.000Z" })
        ],
        2
      ).map((entry) => entry.id)
    ).toEqual(["2", "1"]);
  });

  it("validates stored metric entry shape", () => {
    expect(isMetricEntry(makeEntry())).toBe(true);
    expect(isMetricEntry({ ...makeEntry(), energyLevel: 7 })).toBe(false);
  });
});
