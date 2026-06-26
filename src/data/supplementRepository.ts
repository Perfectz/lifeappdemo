import { createLocalRepository, type LocalRepository } from "@/data/createLocalRepository";
import { isSupplementLogEntry, type SupplementLogEntry } from "@/domain/supplements";

const storageKey = "lifequest.supplements.v1";

export type SupplementRepository = LocalRepository<SupplementLogEntry>;

export function createLocalSupplementRepository(storage: Storage): SupplementRepository {
  return createLocalRepository<SupplementLogEntry>(storage, storageKey, isSupplementLogEntry);
}

export const supplementStorageKey = storageKey;
