import { createLocalRepository, type LocalRepository } from "@/data/createLocalRepository";
import type { DailyPlan } from "@/domain";
import { isDailyPlan } from "@/domain/dailyPlans";

const storageKey = "lifequest.dailyPlans.v1";

export type DailyPlanRepository = LocalRepository<DailyPlan>;

export function createLocalDailyPlanRepository(storage: Storage): DailyPlanRepository {
  return createLocalRepository<DailyPlan>(storage, storageKey, isDailyPlan);
}

export const dailyPlanStorageKey = storageKey;
