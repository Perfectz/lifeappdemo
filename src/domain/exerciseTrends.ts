import { epleyE1Rm, normalizeExerciseName } from "@/domain/strengthProgression";
import type { IsoDate, StrengthSet, Workout } from "@/domain/types";

/**
 * Per-exercise strength progress series for the Trends page (Strong/Hevy
 * parity): pure helpers that turn logged strength workouts into a
 * chronological e1RM / top-set / volume series for one lift.
 */

export type ExerciseSeriesPoint = {
  date: IsoDate;
  /** Heaviest set of the session by estimated 1RM. */
  topSetWeightLbs: number;
  topSetReps: number;
  /** Epley e1RM of the best set, rounded to the nearest lb. */
  e1Rm: number;
  /** Session volume: Σ weight × reps across counted sets. */
  volumeLbs: number;
};

export type ExerciseSeriesStats = {
  currentE1Rm: number;
  bestE1Rm: number;
  /** e1RM change vs the last session ≥30 days before the latest one (falls back to the first session). */
  change30dLbs: number;
};

/** A set counts toward progress charts only with a positive weight and reps. */
function isCountedSet(set: StrengthSet): set is StrengthSet & { weightLbs: number; reps: number } {
  return (
    typeof set.weightLbs === "number" &&
    Number.isFinite(set.weightLbs) &&
    set.weightLbs > 0 &&
    typeof set.reps === "number" &&
    Number.isFinite(set.reps) &&
    set.reps > 0
  );
}

function countedSetsByExercise(workouts: Workout[]): Map<string, { set: StrengthSet & { weightLbs: number; reps: number }; date: IsoDate }[]> {
  const byExercise = new Map<string, { set: StrengthSet & { weightLbs: number; reps: number }; date: IsoDate }[]>();
  for (const workout of workouts) {
    if (workout.type !== "strength" || !Array.isArray(workout.sets)) continue;
    for (const set of workout.sets) {
      if (!isCountedSet(set)) continue;
      const key = normalizeExerciseName(set.exercise);
      if (!key) continue;
      const bucket = byExercise.get(key);
      const item = { set, date: workout.date };
      if (bucket) {
        bucket.push(item);
      } else {
        byExercise.set(key, [item]);
      }
    }
  }
  return byExercise;
}

/**
 * Exercises with at least two distinct session dates carrying weight + reps,
 * ordered by most recent session first. Returns display names (the spelling
 * used on the most recent session).
 */
export function listTrackedExercises(workouts: Workout[]): string[] {
  const tracked: { name: string; latest: IsoDate }[] = [];
  for (const items of countedSetsByExercise(workouts).values()) {
    const dates = new Set(items.map((item) => item.date));
    if (dates.size < 2) continue;
    let latest = items[0];
    for (const item of items) {
      if (item.date > latest.date) latest = item;
    }
    tracked.push({ name: latest.set.exercise, latest: latest.date });
  }
  return tracked
    .sort((a, b) => (a.latest === b.latest ? a.name.localeCompare(b.name) : a.latest < b.latest ? 1 : -1))
    .map((entry) => entry.name);
}

/**
 * Chronological per-session-date series for one exercise: top set (by e1RM),
 * rounded Epley e1RM of that set, and total session volume.
 */
export function buildExerciseSeries(workouts: Workout[], exercise: string): ExerciseSeriesPoint[] {
  const key = normalizeExerciseName(exercise);
  if (!key) return [];
  const items = countedSetsByExercise(workouts).get(key);
  if (!items) return [];

  const byDate = new Map<IsoDate, ExerciseSeriesPoint>();
  for (const { set, date } of items) {
    const score = epleyE1Rm(set.weightLbs, set.reps);
    const volume = set.weightLbs * set.reps;
    const point = byDate.get(date);
    if (!point) {
      byDate.set(date, {
        date,
        topSetWeightLbs: set.weightLbs,
        topSetReps: set.reps,
        e1Rm: Math.round(score),
        volumeLbs: volume
      });
      continue;
    }
    point.volumeLbs += volume;
    if (score > epleyE1Rm(point.topSetWeightLbs, point.topSetReps)) {
      point.topSetWeightLbs = set.weightLbs;
      point.topSetReps = set.reps;
      point.e1Rm = Math.round(score);
    }
  }

  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Current e1RM, all-time best, and ~30-day change for a chronological series. */
export function getExerciseSeriesStats(points: ExerciseSeriesPoint[]): ExerciseSeriesStats | undefined {
  if (points.length === 0) return undefined;
  const current = points[points.length - 1];
  const best = Math.max(...points.map((point) => point.e1Rm));
  const currentMs = Date.parse(current.date);
  let baseline = points[0];
  for (const point of points) {
    if (currentMs - Date.parse(point.date) >= 30 * DAY_MS) {
      baseline = point;
    } else {
      break;
    }
  }
  return {
    currentE1Rm: current.e1Rm,
    bestE1Rm: best,
    change30dLbs: current.e1Rm - baseline.e1Rm
  };
}
