import { dataChangedEventName, emitStorageError } from "@/data/createLocalRepository";
import { emptyWiki, isPersonalWiki, type PersonalWiki } from "@/domain/personalWiki";

const storageKey = "lifequest.wiki.v1";
export const wikiStorageKey = storageKey;

export function loadWiki(storage: Storage): PersonalWiki {
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return emptyWiki();
    const parsed: unknown = JSON.parse(raw);
    return isPersonalWiki(parsed) ? parsed : emptyWiki();
  } catch {
    return emptyWiki();
  }
}

export function saveWiki(storage: Storage, wiki: PersonalWiki): void {
  try {
    storage.setItem(storageKey, JSON.stringify(wiki));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(dataChangedEventName, { detail: { storageKey } }));
    }
  } catch (error) {
    emitStorageError(storageKey, error);
  }
}
