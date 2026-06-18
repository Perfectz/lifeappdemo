import type { GlucoseContext, IsoDate, MetricEntry } from "@/domain/types";
import {
  classifyBloodPressure,
  classifyFastingGlucose,
  type BloodPressureCategory,
  type FastingGlucoseBand
} from "@/domain/biometrics";

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

export const glucoseBandLabel: Record<FastingGlucoseBand, string> = {
  low: "Low",
  normal: "Normal",
  prediabetes: "Prediabetes range",
  diabetes: "High"
};

function byRecentDesc(a: MetricEntry, b: MetricEntry): number {
  return Date.parse(b.recordedAt) - Date.parse(a.recordedAt);
}

/** Entries that carry a blood-pressure, glucose, or body-weight value, newest first. */
export function getVitalsReadings(entries: MetricEntry[]): MetricEntry[] {
  return entries
    .filter(
      (entry) =>
        entry.bloodPressureSystolic !== undefined ||
        entry.weightLbs !== undefined ||
        entry.bloodGlucoseMgDl !== undefined
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

export type LatestGlucose = {
  mgDl: number;
  context?: GlucoseContext;
  /** Band only computed for fasting readings (the ADA reference is fasting-based). */
  band?: FastingGlucoseBand;
  recordedAt: string;
};

export function latestGlucose(entries: MetricEntry[]): LatestGlucose | undefined {
  const found = [...entries]
    .filter((entry) => entry.bloodGlucoseMgDl !== undefined)
    .sort(byRecentDesc)[0];
  if (!found || found.bloodGlucoseMgDl === undefined) return undefined;

  return {
    mgDl: found.bloodGlucoseMgDl,
    context: found.glucoseContext,
    band: found.glucoseContext === "fasting" ? classifyFastingGlucose(found.bloodGlucoseMgDl) : undefined,
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

export type VitalsTrendPoint = {
  date: IsoDate;
  label: string;
  glucose?: number;
  systolic?: number;
  diastolic?: number;
  weightLbs?: number;
};

export type VitalsTrend = {
  points: VitalsTrendPoint[];
  avgGlucose?: number;
  avgSystolic?: number;
  avgDiastolic?: number;
};

function shiftIso(iso: IsoDate, deltaDays: number): IsoDate {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() + deltaDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function average(values: (number | undefined)[]): number | undefined {
  const nums = values.filter((value): value is number => value !== undefined);
  if (nums.length === 0) return undefined;
  return Math.round((nums.reduce((sum, value) => sum + value, 0) / nums.length) * 10) / 10;
}

/**
 * One point per day for the last `days`, each holding that day's latest glucose,
 * blood pressure, and weight (gaps stay undefined). Drives the sparklines.
 */
export function getVitalsTrend(entries: MetricEntry[], today: IsoDate, days = 14): VitalsTrend {
  const sorted = [...entries].sort(byRecentDesc); // newest first
  const points: VitalsTrendPoint[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = shiftIso(today, -offset);
    const dayEntries = sorted.filter((entry) => entry.date === date);
    const pick = (selector: (entry: MetricEntry) => number | undefined): number | undefined => {
      for (const entry of dayEntries) {
        const value = selector(entry);
        if (value !== undefined) return value;
      }
      return undefined;
    };
    points.push({
      date,
      label: date.slice(5),
      glucose: pick((entry) => entry.bloodGlucoseMgDl),
      systolic: pick((entry) => entry.bloodPressureSystolic),
      diastolic: pick((entry) => entry.bloodPressureDiastolic),
      weightLbs: pick((entry) => entry.weightLbs)
    });
  }

  return {
    points,
    avgGlucose: average(points.map((point) => point.glucose)),
    avgSystolic: average(points.map((point) => point.systolic)),
    avgDiastolic: average(points.map((point) => point.diastolic))
  };
}
