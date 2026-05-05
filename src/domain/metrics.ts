import type {
  CheckInType,
  IsoDate,
  IsoDateTime,
  MetricEntry,
  MetricLevel,
  MetricSource
} from "@/domain/types";

export const checkInTypes: CheckInType[] = ["morning", "evening", "freeform"];
export const metricSources: MetricSource[] = ["manual", "samsung_export", "health_connect", "demo"];
export const metricLevels: MetricLevel[] = [1, 2, 3, 4, 5];

export type MetricInput = {
  date: IsoDate;
  checkInType: CheckInType;
  weightLbs?: number;
  sleepHours?: number;
  energyLevel?: number;
  moodLevel?: number;
  steps?: number;
  workoutSummary?: string;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  notes?: string;
};

export type MetricValidationResult =
  | { ok: true; value: MetricInput }
  | { ok: false; message: string };

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function isInteger(value: number | undefined): value is number {
  return value === undefined || Number.isInteger(value);
}

function isPositive(value: number | undefined): boolean {
  return value === undefined || value > 0;
}

function isNonNegative(value: number | undefined): boolean {
  return value === undefined || value >= 0;
}

function isMetricLevel(value: number | undefined): value is MetricLevel | undefined {
  return value === undefined || metricLevels.includes(value as MetricLevel);
}

export function validateMetricInput(input: MetricInput): MetricValidationResult {
  const date = input.date.trim();

  if (!date) {
    return { ok: false, message: "Metric date is required." };
  }

  if (!checkInTypes.includes(input.checkInType)) {
    return { ok: false, message: "Check-in type is invalid." };
  }

  if (!isPositive(input.weightLbs)) {
    return { ok: false, message: "Weight must be positive." };
  }

  if (
    input.sleepHours !== undefined &&
    (input.sleepHours < 0 || input.sleepHours > 24)
  ) {
    return { ok: false, message: "Sleep hours must be between 0 and 24." };
  }

  if (!isMetricLevel(input.energyLevel)) {
    return { ok: false, message: "Energy level must be 1-5." };
  }

  if (!isMetricLevel(input.moodLevel)) {
    return { ok: false, message: "Mood level must be 1-5." };
  }

  if (!isNonNegative(input.steps) || !isInteger(input.steps)) {
    return { ok: false, message: "Steps must be a non-negative whole number." };
  }

  if (
    !isPositive(input.bloodPressureSystolic) ||
    !isInteger(input.bloodPressureSystolic)
  ) {
    return { ok: false, message: "Blood pressure systolic must be a positive whole number." };
  }

  if (
    !isPositive(input.bloodPressureDiastolic) ||
    !isInteger(input.bloodPressureDiastolic)
  ) {
    return { ok: false, message: "Blood pressure diastolic must be a positive whole number." };
  }

  return {
    ok: true,
    value: {
      date,
      checkInType: input.checkInType,
      weightLbs: input.weightLbs,
      sleepHours: input.sleepHours,
      energyLevel: input.energyLevel as MetricLevel | undefined,
      moodLevel: input.moodLevel as MetricLevel | undefined,
      steps: input.steps,
      workoutSummary: normalizeOptionalText(input.workoutSummary),
      bloodPressureSystolic: input.bloodPressureSystolic,
      bloodPressureDiastolic: input.bloodPressureDiastolic,
      notes: normalizeOptionalText(input.notes)
    }
  };
}

export function createMetricEntry(
  input: MetricInput,
  now: IsoDateTime = new Date().toISOString()
): MetricEntry {
  const validation = validateMetricInput(input);

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  return {
    id: globalThis.crypto?.randomUUID?.() ?? `metric-${now}`,
    date: validation.value.date,
    checkInType: validation.value.checkInType,
    source: "manual",
    weightLbs: validation.value.weightLbs,
    sleepHours: validation.value.sleepHours,
    energyLevel: validation.value.energyLevel as MetricLevel | undefined,
    moodLevel: validation.value.moodLevel as MetricLevel | undefined,
    steps: validation.value.steps,
    workoutSummary: validation.value.workoutSummary,
    bloodPressureSystolic: validation.value.bloodPressureSystolic,
    bloodPressureDiastolic: validation.value.bloodPressureDiastolic,
    notes: validation.value.notes,
    recordedAt: now,
    createdAt: now,
    updatedAt: now
  };
}

export function getLatestMetricEntry(entries: MetricEntry[]): MetricEntry | undefined {
  return [...entries].sort((left, right) => {
    const rightTime = Date.parse(right.recordedAt || right.updatedAt);
    const leftTime = Date.parse(left.recordedAt || left.updatedAt);
    return rightTime - leftTime;
  })[0];
}

export function getRecentMetricEntries(entries: MetricEntry[], limit = 5): MetricEntry[] {
  return [...entries]
    .sort((left, right) => Date.parse(right.recordedAt) - Date.parse(left.recordedAt))
    .slice(0, limit);
}

export function isMetricEntry(value: unknown): value is MetricEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<MetricEntry>;

  return (
    typeof entry.id === "string" &&
    typeof entry.date === "string" &&
    entry.checkInType !== undefined &&
    checkInTypes.includes(entry.checkInType) &&
    entry.source !== undefined &&
    metricSources.includes(entry.source) &&
    (entry.weightLbs === undefined || typeof entry.weightLbs === "number") &&
    (entry.sleepHours === undefined || typeof entry.sleepHours === "number") &&
    (entry.energyLevel === undefined || metricLevels.includes(entry.energyLevel)) &&
    (entry.moodLevel === undefined || metricLevels.includes(entry.moodLevel)) &&
    (entry.steps === undefined || typeof entry.steps === "number") &&
    (entry.workoutSummary === undefined || typeof entry.workoutSummary === "string") &&
    (entry.bloodPressureSystolic === undefined ||
      typeof entry.bloodPressureSystolic === "number") &&
    (entry.bloodPressureDiastolic === undefined ||
      typeof entry.bloodPressureDiastolic === "number") &&
    (entry.notes === undefined || typeof entry.notes === "string") &&
    typeof entry.recordedAt === "string" &&
    typeof entry.createdAt === "string" &&
    typeof entry.updatedAt === "string"
  );
}
