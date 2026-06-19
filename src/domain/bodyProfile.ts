import type { IsoDateTime } from "@/domain/types";
import { activityLevels, type ActivityLevel, type BiologicalSex } from "@/domain/calorieBudget";

/**
 * Body stats used for the calorie-budget calculator plus a one-time setup flag.
 * Personal, so it lives on-device/synced — never committed to source.
 */
export type BodyProfile = {
  sex?: BiologicalSex;
  age?: number;
  heightInches?: number;
  activityLevel?: ActivityLevel;
  setupCompleted: boolean;
  updatedAt: IsoDateTime;
};

export function emptyBodyProfile(now: IsoDateTime = new Date().toISOString()): BodyProfile {
  return { setupCompleted: false, updatedAt: now };
}

function optionalPositive(value: unknown): boolean {
  return value === undefined || (typeof value === "number" && Number.isFinite(value) && value > 0);
}

export function isBodyProfile(value: unknown): value is BodyProfile {
  if (!value || typeof value !== "object") {
    return false;
  }
  const profile = value as Partial<BodyProfile>;
  return (
    typeof profile.setupCompleted === "boolean" &&
    typeof profile.updatedAt === "string" &&
    (profile.sex === undefined || profile.sex === "male" || profile.sex === "female") &&
    (profile.activityLevel === undefined ||
      activityLevels.includes(profile.activityLevel as ActivityLevel)) &&
    optionalPositive(profile.age) &&
    optionalPositive(profile.heightInches)
  );
}

export function withBodyProfileEdits(
  current: BodyProfile,
  edits: Partial<Omit<BodyProfile, "updatedAt">>,
  now: IsoDateTime = new Date().toISOString()
): BodyProfile {
  return { ...current, ...edits, updatedAt: now };
}

/** True once the user has enough set for the app's goal-driven screens to be useful. */
export function hasCompletedSetup(profile: BodyProfile): boolean {
  return profile.setupCompleted;
}
