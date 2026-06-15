import { describe, expect, it } from "vitest";

import {
  classifyBloodPressure,
  classifyFastingGlucose,
  createBiometricReading,
  isBiometricReading,
  validateBiometricReadingInput
} from "@/domain/biometrics";

const now = "2026-06-15T07:00:00.000Z";

describe("biometrics domain", () => {
  it("creates glucose / blood-pressure / value readings", () => {
    const glucose = createBiometricReading({ kind: "blood_glucose", glucoseMgDl: 95, glucoseContext: "fasting" }, now);
    expect(glucose).toMatchObject({ kind: "blood_glucose", glucoseMgDl: 95, recordedAt: now });

    const bp = createBiometricReading({ kind: "blood_pressure", systolic: 122, diastolic: 78 }, now);
    expect(bp).toMatchObject({ kind: "blood_pressure", systolic: 122, diastolic: 78 });

    const weight = createBiometricReading({ kind: "body_weight", value: 185, unit: "lb" }, now);
    expect(weight).toMatchObject({ kind: "body_weight", value: 185 });
  });

  it("requires the kind-specific fields", () => {
    expect(validateBiometricReadingInput({ kind: "blood_glucose" }).ok).toBe(false);
    expect(validateBiometricReadingInput({ kind: "blood_pressure", systolic: 120 }).ok).toBe(false);
    expect(validateBiometricReadingInput({ kind: "body_weight" }).ok).toBe(false);
  });

  it("classifies blood pressure by AHA bands", () => {
    expect(classifyBloodPressure(118, 75)).toBe("normal");
    expect(classifyBloodPressure(125, 75)).toBe("elevated");
    expect(classifyBloodPressure(135, 85)).toBe("hypertension_stage_1");
    expect(classifyBloodPressure(145, 95)).toBe("hypertension_stage_2");
    expect(classifyBloodPressure(185, 125)).toBe("hypertensive_crisis");
  });

  it("classifies fasting glucose by ADA bands", () => {
    expect(classifyFastingGlucose(65)).toBe("low");
    expect(classifyFastingGlucose(90)).toBe("normal");
    expect(classifyFastingGlucose(110)).toBe("prediabetes");
    expect(classifyFastingGlucose(140)).toBe("diabetes");
  });

  it("guards biometric-reading shape", () => {
    expect(isBiometricReading(createBiometricReading({ kind: "resting_heart_rate", value: 58 }, now))).toBe(true);
    expect(isBiometricReading({ id: "x", kind: "blood_glucose" })).toBe(false);
  });
});
