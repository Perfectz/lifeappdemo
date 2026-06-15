import { createLocalRepository, type LocalRepository } from "@/data/createLocalRepository";
import type { Workout } from "@/domain";
import { isWorkout } from "@/domain/workouts";

const storageKey = "lifequest.workouts.v1";

export type WorkoutRepository = LocalRepository<Workout>;

export function createLocalWorkoutRepository(storage: Storage): WorkoutRepository {
  return createLocalRepository<Workout>(storage, storageKey, isWorkout);
}

export const workoutStorageKey = storageKey;
