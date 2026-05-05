import type { JournalEntry } from "@/domain";
import { isJournalEntry } from "@/domain/journal";

const storageKey = "lifequest.journalEntries.v1";

export type JournalRepository = {
  load(): JournalEntry[];
  save(entries: JournalEntry[]): void;
};

export function createLocalJournalRepository(storage: Storage): JournalRepository {
  return {
    load() {
      const raw = storage.getItem(storageKey);

      if (!raw) {
        return [];
      }

      try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(isJournalEntry) : [];
      } catch {
        return [];
      }
    },
    save(entries) {
      storage.setItem(storageKey, JSON.stringify(entries));
    }
  };
}

export const journalStorageKey = storageKey;
