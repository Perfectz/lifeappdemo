import type { IsoDateTime } from "@/domain/types";

/**
 * The user's North Star health targets. Defaults are standard clinical
 * guidance (AHA blood-pressure goal, ADA fasting-glucose upper-normal, common
 * sleep guidance) — NOT personal data — so the card is useful before the user
 * sets anything. Personal targets (e.g. a weight goal) start empty and are
 * edited in-app, never committed to source.
 */
export type HealthGoals = {
  weightTargetLbs?: number;
  weightStartLbs?: number;
  bpSystolicTarget: number;
  bpDiastolicTarget: number;
  fastingGlucoseTarget: number;
  sleepHoursTarget: number;
  dailyWorkoutsTarget: number;
  updatedAt: IsoDateTime;
};

export const DEFAULT_HEALTH_GOALS: Omit<HealthGoals, "updatedAt"> = {
  bpSystolicTarget: 130,
  bpDiastolicTarget: 80,
  fastingGlucoseTarget: 100,
  sleepHoursTarget: 7.5,
  dailyWorkoutsTarget: 3
};

export function defaultHealthGoals(now: IsoDateTime = new Date().toISOString()): HealthGoals {
  return { ...DEFAULT_HEALTH_GOALS, updatedAt: now };
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function isHealthGoals(value: unknown): value is HealthGoals {
  if (!value || typeof value !== "object") {
    return false;
  }
  const goals = value as Partial<HealthGoals>;
  return (
    isPositiveNumber(goals.bpSystolicTarget) &&
    isPositiveNumber(goals.bpDiastolicTarget) &&
    isPositiveNumber(goals.fastingGlucoseTarget) &&
    isPositiveNumber(goals.sleepHoursTarget) &&
    isPositiveNumber(goals.dailyWorkoutsTarget) &&
    (goals.weightTargetLbs === undefined || isPositiveNumber(goals.weightTargetLbs)) &&
    (goals.weightStartLbs === undefined || isPositiveNumber(goals.weightStartLbs)) &&
    typeof goals.updatedAt === "string"
  );
}

/** Merge a partial edit onto the current goals, stamping updatedAt. */
export function withGoalEdits(
  current: HealthGoals,
  edits: Partial<Omit<HealthGoals, "updatedAt">>,
  now: IsoDateTime = new Date().toISOString()
): HealthGoals {
  return { ...current, ...edits, updatedAt: now };
}

/**
 * Progress toward a weight target as a 0–100 percent, measured from the
 * recorded start weight. Returns undefined when there isn't enough info.
 */
export function weightGoalProgressPercent(
  goals: HealthGoals,
  currentWeightLbs: number | undefined
): number | undefined {
  if (
    goals.weightTargetLbs === undefined ||
    goals.weightStartLbs === undefined ||
    currentWeightLbs === undefined
  ) {
    return undefined;
  }
  const totalToLose = goals.weightStartLbs - goals.weightTargetLbs;
  if (totalToLose <= 0) {
    return currentWeightLbs <= goals.weightTargetLbs ? 100 : 0;
  }
  const lost = goals.weightStartLbs - currentWeightLbs;
  return Math.max(0, Math.min(100, Math.round((lost / totalToLose) * 100)));
}
