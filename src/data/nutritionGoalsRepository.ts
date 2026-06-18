import { dataChangedEventName, emitStorageError } from "@/data/createLocalRepository";
import {
  defaultNutritionGoals,
  isNutritionGoals,
  type NutritionGoals
} from "@/domain/nutritionGoals";

const storageKey = "lifequest.nutritionGoals.v1";
export const nutritionGoalsStorageKey = storageKey;

export function loadNutritionGoals(storage: Storage): NutritionGoals {
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return defaultNutritionGoals();
    const parsed: unknown = JSON.parse(raw);
    return isNutritionGoals(parsed) ? parsed : defaultNutritionGoals();
  } catch {
    return defaultNutritionGoals();
  }
}

export function saveNutritionGoals(storage: Storage, goals: NutritionGoals): void {
  try {
    storage.setItem(storageKey, JSON.stringify(goals));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(dataChangedEventName, { detail: { storageKey } }));
    }
  } catch (error) {
    emitStorageError(storageKey, error);
  }
}
