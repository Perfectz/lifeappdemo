import type { EveningPostmortem } from "@/domain";
import { isEveningPostmortem } from "@/domain/eveningPostmortems";

const storageKey = "lifequest.eveningPostmortems.v1";

export type EveningPostmortemRepository = {
  load(): EveningPostmortem[];
  save(postmortems: EveningPostmortem[]): void;
};

export function createLocalEveningPostmortemRepository(
  storage: Storage
): EveningPostmortemRepository {
  return {
    load() {
      const raw = storage.getItem(storageKey);

      if (!raw) {
        return [];
      }

      try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(isEveningPostmortem) : [];
      } catch {
        return [];
      }
    },
    save(postmortems) {
      storage.setItem(storageKey, JSON.stringify(postmortems));
    }
  };
}

export const eveningPostmortemStorageKey = storageKey;
