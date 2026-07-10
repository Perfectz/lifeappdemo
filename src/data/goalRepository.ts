import { createLocalRepository, type LocalRepository } from "@/data/createLocalRepository";
import { isGoal } from "@/domain/goals";
import type { Goal } from "@/domain/types";

const storageKey = "lifequest.goals.v1";

export type GoalRepository = LocalRepository<Goal>;

export function createLocalGoalRepository(storage: Storage): GoalRepository {
  return createLocalRepository<Goal>(storage, storageKey, isGoal);
}

export const goalStorageKey = storageKey;
