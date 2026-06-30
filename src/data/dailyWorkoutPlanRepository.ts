import { createLocalRepository, type LocalRepository } from "@/data/createLocalRepository";
import { isDailyWorkoutPlan, type DailyWorkoutPlan } from "@/domain/workoutPlan";
import type { IsoDate } from "@/domain/types";

const storageKey = "lifequest.dailyWorkoutPlans.v1";

export type DailyWorkoutPlanRepository = LocalRepository<DailyWorkoutPlan>;

export function createDailyWorkoutPlanRepository(storage: Storage): DailyWorkoutPlanRepository {
  return createLocalRepository<DailyWorkoutPlan>(storage, storageKey, isDailyWorkoutPlan);
}

export const dailyWorkoutPlanStorageKey = storageKey;

export function getWorkoutPlanForDate(storage: Storage, date: IsoDate): DailyWorkoutPlan | undefined {
  return createDailyWorkoutPlanRepository(storage)
    .load()
    .find((p) => p.date === date);
}

export function upsertWorkoutPlan(storage: Storage, plan: DailyWorkoutPlan): void {
  const repo = createDailyWorkoutPlanRepository(storage);
  const others = repo.load().filter((p) => p.date !== plan.date);
  const next = [...others, plan].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 60);
  repo.save(next);
}

export function clearWorkoutPlanForDate(storage: Storage, date: IsoDate): void {
  const repo = createDailyWorkoutPlanRepository(storage);
  repo.save(repo.load().filter((p) => p.date !== date));
}
