import { createLocalRepository, type LocalRepository } from "@/data/createLocalRepository";
import { isWaterEntry, type WaterEntry } from "@/domain/waterTracking";

const storageKey = "lifequest.water.v1";

export type WaterRepository = LocalRepository<WaterEntry>;

export function createLocalWaterRepository(storage: Storage): WaterRepository {
  return createLocalRepository<WaterEntry>(storage, storageKey, isWaterEntry);
}

export const waterStorageKey = storageKey;
