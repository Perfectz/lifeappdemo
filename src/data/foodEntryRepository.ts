import { createLocalRepository, type LocalRepository } from "@/data/createLocalRepository";
import type { FoodEntry } from "@/domain";
import { isFoodEntry } from "@/domain/nutrition";

const storageKey = "lifequest.foodEntries.v1";

export type FoodEntryRepository = LocalRepository<FoodEntry>;

export function createLocalFoodEntryRepository(storage: Storage): FoodEntryRepository {
  return createLocalRepository<FoodEntry>(storage, storageKey, isFoodEntry);
}

export const foodEntryStorageKey = storageKey;
