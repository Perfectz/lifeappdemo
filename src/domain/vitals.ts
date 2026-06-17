import type { MetricEntry } from "@/domain/types";
import { classifyBloodPressure, type BloodPressureCategory } from "@/domain/biometrics";

/**
 * Vitals views over MetricEntry data (single source of truth — the same store
 * the metrics form, voice agent, photo capture, and health import write to).
 */

export const bloodPressureCategoryLabel: Record<BloodPressureCategory, string> = {
  normal: "Normal",
  elevated: "Elevated",
  hypertension_stage_1: "Hypertension stage 1",
  hypertension_stage_2: "Hypertension stage 2",
  hypertensive_crisis: "Hypertensive crisis"
};

function byRecentDesc(a: MetricEntry, b: MetricEntry): number {
  return Date.parse(b.recordedAt) - Date.parse(a.recordedAt);
}

/** Entries that carry a blood-pressure reading or a body-weight value, newest first. */
export function getVitalsReadings(entries: MetricEntry[]): MetricEntry[] {
  return entries
    .filter(
      (entry) => entry.bloodPressureSystolic !== undefined || entry.weightLbs !== undefined
    )
    .sort(byRecentDesc);
}

export type LatestBloodPressure = {
  systolic: number;
  diastolic: number;
  category: BloodPressureCategory;
  recordedAt: string;
};

export function latestBloodPressure(entries: MetricEntry[]): LatestBloodPressure | undefined {
  const found = [...entries]
    .filter(
      (entry) =>
        entry.bloodPressureSystolic !== undefined && entry.bloodPressureDiastolic !== undefined
    )
    .sort(byRecentDesc)[0];

  if (
    !found ||
    found.bloodPressureSystolic === undefined ||
    found.bloodPressureDiastolic === undefined
  ) {
    return undefined;
  }

  return {
    systolic: found.bloodPressureSystolic,
    diastolic: found.bloodPressureDiastolic,
    category: classifyBloodPressure(found.bloodPressureSystolic, found.bloodPressureDiastolic),
    recordedAt: found.recordedAt
  };
}

export type LatestWeight = { weightLbs: number; recordedAt: string; changeLbs?: number };

export function latestWeight(entries: MetricEntry[]): LatestWeight | undefined {
  const weights = [...entries].filter((entry) => entry.weightLbs !== undefined).sort(byRecentDesc);
  const current = weights[0];
  if (!current || current.weightLbs === undefined) return undefined;

  const previous = weights[1];
  return {
    weightLbs: current.weightLbs,
    recordedAt: current.recordedAt,
    changeLbs:
      previous?.weightLbs !== undefined
        ? Math.round((current.weightLbs - previous.weightLbs) * 10) / 10
        : undefined
  };
}
