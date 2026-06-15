import type {
  BiometricKind,
  BiometricReading,
  BiometricSource,
  GlucoseContext,
  IsoDateTime
} from "@/domain/types";

export const biometricKinds: BiometricKind[] = [
  "blood_glucose",
  "blood_pressure",
  "resting_heart_rate",
  "body_weight",
  "spo2"
];
export const glucoseContexts: GlucoseContext[] = [
  "fasting",
  "pre_meal",
  "post_meal",
  "random",
  "bedtime"
];
export const biometricSources: BiometricSource[] = ["manual", "device", "health_connect", "demo"];

export type BiometricReadingInput = {
  kind: BiometricKind;
  recordedAt?: IsoDateTime;
  glucoseMgDl?: number;
  glucoseContext?: GlucoseContext;
  systolic?: number;
  diastolic?: number;
  pulseBpm?: number;
  value?: number;
  unit?: string;
  source?: BiometricSource;
  notes?: string;
};

export type BiometricReadingValidationResult =
  | { ok: true; value: BiometricReadingInput & { kind: BiometricKind } }
  | { ok: false; message: string };

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function optionalFiniteNumber(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function validateBiometricReadingInput(
  input: BiometricReadingInput
): BiometricReadingValidationResult {
  if (!biometricKinds.includes(input.kind)) {
    return { ok: false, message: "Biometric kind is invalid." };
  }

  if (input.kind === "blood_glucose" && optionalFiniteNumber(input.glucoseMgDl) === undefined) {
    return { ok: false, message: "Blood glucose reading requires a mg/dL value." };
  }

  if (
    input.kind === "blood_pressure" &&
    (optionalFiniteNumber(input.systolic) === undefined ||
      optionalFiniteNumber(input.diastolic) === undefined)
  ) {
    return { ok: false, message: "Blood pressure reading requires systolic and diastolic values." };
  }

  if (
    (input.kind === "resting_heart_rate" ||
      input.kind === "body_weight" ||
      input.kind === "spo2") &&
    optionalFiniteNumber(input.value) === undefined
  ) {
    return { ok: false, message: "This reading requires a numeric value." };
  }

  const glucoseContext =
    input.glucoseContext && glucoseContexts.includes(input.glucoseContext)
      ? input.glucoseContext
      : undefined;
  const source = input.source && biometricSources.includes(input.source) ? input.source : "manual";

  return {
    ok: true,
    value: {
      kind: input.kind,
      recordedAt: normalizeOptionalText(input.recordedAt),
      glucoseMgDl: optionalFiniteNumber(input.glucoseMgDl),
      glucoseContext,
      systolic: optionalFiniteNumber(input.systolic),
      diastolic: optionalFiniteNumber(input.diastolic),
      pulseBpm: optionalFiniteNumber(input.pulseBpm),
      value: optionalFiniteNumber(input.value),
      unit: normalizeOptionalText(input.unit),
      source,
      notes: normalizeOptionalText(input.notes)
    }
  };
}

export function createBiometricReading(
  input: BiometricReadingInput,
  now: IsoDateTime = new Date().toISOString()
): BiometricReading {
  const validation = validateBiometricReadingInput(input);

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const { value } = validation;

  return {
    id: globalThis.crypto?.randomUUID?.() ?? `biometric-${now}`,
    kind: value.kind,
    recordedAt: value.recordedAt ?? now,
    glucoseMgDl: value.glucoseMgDl,
    glucoseContext: value.glucoseContext,
    systolic: value.systolic,
    diastolic: value.diastolic,
    pulseBpm: value.pulseBpm,
    value: value.value,
    unit: value.unit,
    source: value.source ?? "manual",
    notes: value.notes,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Informational AHA blood-pressure category. NOT a diagnosis — used only to
 * label trends for the user; the UI always pairs this with a "not medical
 * advice" disclaimer.
 */
export type BloodPressureCategory =
  | "normal"
  | "elevated"
  | "hypertension_stage_1"
  | "hypertension_stage_2"
  | "hypertensive_crisis";

export function classifyBloodPressure(
  systolic: number,
  diastolic: number
): BloodPressureCategory {
  if (systolic > 180 || diastolic > 120) {
    return "hypertensive_crisis";
  }
  if (systolic >= 140 || diastolic >= 90) {
    return "hypertension_stage_2";
  }
  if (systolic >= 130 || diastolic >= 80) {
    return "hypertension_stage_1";
  }
  if (systolic >= 120) {
    return "elevated";
  }
  return "normal";
}

/** Informational fasting-glucose band (ADA reference ranges). Not a diagnosis. */
export type FastingGlucoseBand = "low" | "normal" | "prediabetes" | "diabetes";

export function classifyFastingGlucose(mgDl: number): FastingGlucoseBand {
  if (mgDl < 70) {
    return "low";
  }
  if (mgDl < 100) {
    return "normal";
  }
  if (mgDl < 126) {
    return "prediabetes";
  }
  return "diabetes";
}

export function isBiometricReading(value: unknown): value is BiometricReading {
  if (!value || typeof value !== "object") {
    return false;
  }

  const reading = value as Partial<BiometricReading>;

  return (
    typeof reading.id === "string" &&
    reading.kind !== undefined &&
    biometricKinds.includes(reading.kind) &&
    typeof reading.recordedAt === "string" &&
    reading.source !== undefined &&
    biometricSources.includes(reading.source) &&
    typeof reading.createdAt === "string" &&
    typeof reading.updatedAt === "string"
  );
}
