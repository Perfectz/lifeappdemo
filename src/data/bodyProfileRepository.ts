import { dataChangedEventName, emitStorageError } from "@/data/createLocalRepository";
import { emptyBodyProfile, isBodyProfile, type BodyProfile } from "@/domain/bodyProfile";

const storageKey = "lifequest.bodyProfile.v1";
export const bodyProfileStorageKey = storageKey;

export function loadBodyProfile(storage: Storage): BodyProfile {
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return emptyBodyProfile();
    const parsed: unknown = JSON.parse(raw);
    return isBodyProfile(parsed) ? parsed : emptyBodyProfile();
  } catch {
    return emptyBodyProfile();
  }
}

export function saveBodyProfile(storage: Storage, profile: BodyProfile): void {
  try {
    storage.setItem(storageKey, JSON.stringify(profile));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(dataChangedEventName, { detail: { storageKey } }));
    }
  } catch (error) {
    emitStorageError(storageKey, error);
  }
}
