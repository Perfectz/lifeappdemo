import type { DailyPlan } from "@/domain";
import { isDailyPlan } from "@/domain/dailyPlans";

const storageKey = "lifequest.dailyPlans.v1";

export type DailyPlanRepository = {
  load(): DailyPlan[];
  save(plans: DailyPlan[]): void;
};

export function createLocalDailyPlanRepository(storage: Storage): DailyPlanRepository {
  return {
    load() {
      const raw = storage.getItem(storageKey);

      if (!raw) {
        return [];
      }

      try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(isDailyPlan) : [];
      } catch {
        return [];
      }
    },
    save(plans) {
      storage.setItem(storageKey, JSON.stringify(plans));
    }
  };
}

export const dailyPlanStorageKey = storageKey;
