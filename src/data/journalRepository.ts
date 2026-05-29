import { createLocalRepository, type LocalRepository } from "@/data/createLocalRepository";
import type { JournalEntry } from "@/domain";
import { isJournalEntry } from "@/domain/journal";

const storageKey = "lifequest.journalEntries.v1";

export type JournalRepository = LocalRepository<JournalEntry>;

export function createLocalJournalRepository(storage: Storage): JournalRepository {
  return createLocalRepository<JournalEntry>(storage, storageKey, isJournalEntry);
}

export const journalStorageKey = storageKey;
