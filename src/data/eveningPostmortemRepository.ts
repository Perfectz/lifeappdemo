import { createLocalRepository, type LocalRepository } from "@/data/createLocalRepository";
import type { EveningPostmortem } from "@/domain";
import { isEveningPostmortem } from "@/domain/eveningPostmortems";

const storageKey = "lifequest.eveningPostmortems.v1";

export type EveningPostmortemRepository = LocalRepository<EveningPostmortem>;

export function createLocalEveningPostmortemRepository(
  storage: Storage
): EveningPostmortemRepository {
  return createLocalRepository<EveningPostmortem>(storage, storageKey, isEveningPostmortem);
}

export const eveningPostmortemStorageKey = storageKey;
