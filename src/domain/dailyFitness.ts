import type { IsoDate, Workout, WorkoutType } from "@/domain/types";

/** The three required daily sessions, in display order. */
export const requiredSessionTypes: WorkoutType[] = ["strength", "cardio", "martial_arts"];

export type DailyFitnessStatus = {
  date: IsoDate;
  byType: Record<WorkoutType, Workout | undefined>;
  completedCount: number;
  /** All three sessions logged (the stretch goal). */
  isComplete: boolean;
  /** A "good day" needs just ONE session; the rest are bonus. */
  isGoodDay: boolean;
  /** Sessions beyond the first — bonus credit. */
  bonusCount: number;
};

/**
 * Summarize a day's training: which of the three required sessions are logged
 * and whether the day's goal (all three) is met. If a type was logged more
 * than once, the most recent entry wins.
 */
export function getDailyFitnessStatus(workouts: Workout[], date: IsoDate): DailyFitnessStatus {
  const todays = workouts
    .filter((workout) => workout.date === date)
    .sort((a, b) => (b.recordedAt > a.recordedAt ? 1 : -1));

  const pick = (type: WorkoutType): Workout | undefined =>
    todays.find((workout) => workout.type === type);

  const byType: Record<WorkoutType, Workout | undefined> = {
    strength: pick("strength"),
    cardio: pick("cardio"),
    martial_arts: pick("martial_arts")
  };

  const completedCount = requiredSessionTypes.filter((type) => byType[type]).length;

  return {
    date,
    byType,
    completedCount,
    isComplete: completedCount === requiredSessionTypes.length,
    isGoodDay: completedCount >= 1,
    bonusCount: Math.max(0, completedCount - 1)
  };
}
