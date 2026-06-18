import { dataChangedEventName, emitStorageError } from "@/data/createLocalRepository";
import { defaultHealthGoals, isHealthGoals, type HealthGoals } from "@/domain/healthGoals";

const storageKey = "lifequest.healthGoals.v1";
export const healthGoalsStorageKey = storageKey;

export function loadHealthGoals(storage: Storage): HealthGoals {
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return defaultHealthGoals();
    const parsed: unknown = JSON.parse(raw);
    return isHealthGoals(parsed) ? parsed : defaultHealthGoals();
  } catch {
    return defaultHealthGoals();
  }
}

export function saveHealthGoals(storage: Storage, goals: HealthGoals): void {
  try {
    storage.setItem(storageKey, JSON.stringify(goals));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(dataChangedEventName, { detail: { storageKey } }));
    }
  } catch (error) {
    emitStorageError(storageKey, error);
  }
}
