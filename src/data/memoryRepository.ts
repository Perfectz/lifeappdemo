import { createLocalRepository, type LocalRepository } from "@/data/createLocalRepository";
import type { MemoryEntry } from "@/domain/memory";
import { isMemoryEntry } from "@/domain/memory";

const storageKey = "lifequest.memories.v1";

export type MemoryRepository = LocalRepository<MemoryEntry>;

export function createLocalMemoryRepository(storage: Storage): MemoryRepository {
  return createLocalRepository<MemoryEntry>(storage, storageKey, isMemoryEntry);
}

export const memoryStorageKey = storageKey;
