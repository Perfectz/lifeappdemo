import { createLocalRepository, type LocalRepository } from "@/data/createLocalRepository";
import {
  isDailyNutritionTarget,
  type DailyNutritionTarget
} from "@/domain/dailyNutritionTarget";
import type { IsoDate } from "@/domain/types";

const storageKey = "lifequest.dailyNutritionTargets.v1";

export type DailyNutritionTargetRepository = LocalRepository<DailyNutritionTarget>;

export function createDailyNutritionTargetRepository(
  storage: Storage
): DailyNutritionTargetRepository {
  return createLocalRepository<DailyNutritionTarget>(storage, storageKey, isDailyNutritionTarget);
}

export const dailyNutritionTargetStorageKey = storageKey;

export function getTargetForDate(
  storage: Storage,
  date: IsoDate
): DailyNutritionTarget | undefined {
  return createDailyNutritionTargetRepository(storage)
    .load()
    .find((t) => t.date === date);
}

/** Insert or replace the target for its date (one target per day). */
export function upsertDailyTarget(storage: Storage, target: DailyNutritionTarget): void {
  const repo = createDailyNutritionTargetRepository(storage);
  const others = repo.load().filter((t) => t.date !== target.date);
  // Keep history bounded (most recent 120 days).
  const next = [...others, target]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 120);
  repo.save(next);
}

export function clearTargetForDate(storage: Storage, date: IsoDate): void {
  const repo = createDailyNutritionTargetRepository(storage);
  repo.save(repo.load().filter((t) => t.date !== date));
}
