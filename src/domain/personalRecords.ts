import { epleyE1Rm, normalizeExerciseName } from "@/domain/strengthProgression";
import type { Workout } from "@/domain/types";

/**
 * Personal-record detection over the logged strength history. Pure functions —
 * nothing is persisted: records (and the "PR" badges in the UI) are always
 * recomputed from the workout log, so history edits stay authoritative.
 */

export type PersonalRecordKind = "weight" | "e1rm" | "reps";

export type PersonalRecord = {
  /** Display name of the exercise, parenthetical scheme stripped. */
  exercise: string;
  kind: PersonalRecordKind;
  /** Index of the set in the new workout's `sets` array that set the record. */
  setIndex: number;
  /** New best (lb for weight/e1rm, reps for reps-at-weight). */
  value: number;
  /** Previous best that was beaten. */
  previousValue: number;
  /** For "reps" records: the weight the reps were performed at. */
  weightLbs?: number;
  /** Human line, e.g. `New e1RM: Incline Bench 205 lb (was 198)`. */
  summary: string;
};

export type ExerciseRecords = {
  /** Display name from the most recent occurrence. */
  exercise: string;
  /** Heaviest weight moved for any reps. */
  bestWeightLbs: number;
  /** Best Epley estimated 1RM. */
  bestE1Rm: number;
  /** Best rep count per exact weight (lb → reps). */
  bestRepsAtWeight: Map<number, number>;
};

/** "Incline Dumbbell Press (4 × 8–10)" → "Incline Dumbbell Press". */
export function displayExerciseName(name: string): string {
  return name
    .replace(/\(.*?\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isWeighted(set: { weightLbs?: number }): set is { weightLbs: number } {
  return typeof set.weightLbs === "number" && Number.isFinite(set.weightLbs) && set.weightLbs > 0;
}

/**
 * Aggregate per-exercise records across a workout history. Only strength
 * workouts with weighted sets contribute; exercises are keyed by
 * `normalizeExerciseName` (strict equality — no fuzzy matching, so "Incline
 * Bench" and "Bench" stay separate records).
 */
export function computePersonalRecords(workouts: Workout[]): Map<string, ExerciseRecords> {
  const records = new Map<string, ExerciseRecords>();
  for (const workout of workouts) {
    if (workout.type !== "strength" || !Array.isArray(workout.sets)) continue;
    for (const set of workout.sets) {
      if (!isWeighted(set)) continue;
      const key = normalizeExerciseName(set.exercise);
      if (!key) continue;
      const e1Rm = epleyE1Rm(set.weightLbs, set.reps ?? 1);
      const existing = records.get(key);
      if (!existing) {
        const fresh: ExerciseRecords = {
          exercise: displayExerciseName(set.exercise),
          bestWeightLbs: set.weightLbs,
          bestE1Rm: e1Rm,
          bestRepsAtWeight: new Map()
        };
        if (typeof set.reps === "number" && set.reps > 0) {
          fresh.bestRepsAtWeight.set(set.weightLbs, set.reps);
        }
        records.set(key, fresh);
        continue;
      }
      existing.exercise = displayExerciseName(set.exercise);
      existing.bestWeightLbs = Math.max(existing.bestWeightLbs, set.weightLbs);
      existing.bestE1Rm = Math.max(existing.bestE1Rm, e1Rm);
      if (typeof set.reps === "number" && set.reps > 0) {
        const prior = existing.bestRepsAtWeight.get(set.weightLbs) ?? 0;
        if (set.reps > prior) existing.bestRepsAtWeight.set(set.weightLbs, set.reps);
      }
    }
  }
  return records;
}

const KIND_ORDER: Record<PersonalRecordKind, number> = { weight: 0, e1rm: 1, reps: 2 };

function formatLbs(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/**
 * What did `newWorkout` just beat, judged against `previousWorkouts` only?
 *
 * - An exercise with no prior weighted history is a baseline: logging it for
 *   the first time is never a PR (no first-session celebration spam).
 * - Weight PR: heaviest weight moved for any reps.
 * - e1RM PR: best Epley estimated 1RM (can fire without a weight PR).
 * - Reps PR: more reps than ever before at an exact weight already in the log.
 * - At most one record per exercise per kind — the best set wins.
 */
export function detectNewRecords(previousWorkouts: Workout[], newWorkout: Workout): PersonalRecord[] {
  if (newWorkout.type !== "strength" || !Array.isArray(newWorkout.sets)) return [];
  const prior = computePersonalRecords(previousWorkouts);
  const best = new Map<string, PersonalRecord>();

  const consider = (candidate: PersonalRecord) => {
    const key = `${normalizeExerciseName(candidate.exercise)}|${candidate.kind}`;
    const current = best.get(key);
    if (!current || candidate.value > current.value) best.set(key, candidate);
  };

  newWorkout.sets.forEach((set, setIndex) => {
    if (!isWeighted(set)) return;
    const key = normalizeExerciseName(set.exercise);
    const history = key ? prior.get(key) : undefined;
    // First time this exercise carries weight in the log → baseline, not a PR.
    if (!history) return;

    const name = displayExerciseName(set.exercise);

    if (set.weightLbs > history.bestWeightLbs) {
      consider({
        exercise: name,
        kind: "weight",
        setIndex,
        value: set.weightLbs,
        previousValue: history.bestWeightLbs,
        summary: `New weight PR: ${name} ${formatLbs(set.weightLbs)} lb (was ${formatLbs(history.bestWeightLbs)})`
      });
    }

    const e1Rm = epleyE1Rm(set.weightLbs, set.reps ?? 1);
    if (e1Rm > history.bestE1Rm + 1e-9) {
      consider({
        exercise: name,
        kind: "e1rm",
        setIndex,
        value: e1Rm,
        previousValue: history.bestE1Rm,
        summary: `New e1RM: ${name} ${Math.round(e1Rm)} lb (was ${Math.round(history.bestE1Rm)})`
      });
    }

    if (typeof set.reps === "number" && set.reps > 0) {
      const priorReps = history.bestRepsAtWeight.get(set.weightLbs);
      if (typeof priorReps === "number" && set.reps > priorReps) {
        consider({
          exercise: name,
          kind: "reps",
          setIndex,
          value: set.reps,
          previousValue: priorReps,
          weightLbs: set.weightLbs,
          summary: `New reps PR: ${name} ${set.reps} × ${formatLbs(set.weightLbs)} lb (was ${priorReps})`
        });
      }
    }
  });

  return [...best.values()].sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.exercise.localeCompare(b.exercise)
  );
}

/** "NEW RECORD — INCLINE BENCH 205 LB" (reps records read "10 × 185 LB"). */
export function formatRecordTitle(record: PersonalRecord): string {
  const name = record.exercise.toUpperCase();
  if (record.kind === "reps") {
    return `NEW RECORD — ${name} ${record.value} × ${formatLbs(record.weightLbs ?? 0)} LB`;
  }
  return `NEW RECORD — ${name} ${Math.round(record.value)} LB`;
}

/**
 * Which set rows of an already-logged workout earned a "PR" badge? Recomputed
 * from history — the badge is judged against everything recorded strictly
 * before this workout (by `recordedAt`, falling back to `date`).
 */
export function prSetIndexesForWorkout(allWorkouts: Workout[], workout: Workout): Set<number> {
  const before = allWorkouts.filter((w) => {
    if (w.id === workout.id) return false;
    if (w.recordedAt && workout.recordedAt) return w.recordedAt < workout.recordedAt;
    return w.date < workout.date;
  });
  return new Set(detectNewRecords(before, workout).map((r) => r.setIndex));
}
