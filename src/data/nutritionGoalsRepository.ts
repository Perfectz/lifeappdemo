import { createDocumentStore } from "@/data/createDocumentStore";
import {
  defaultNutritionGoals,
  isNutritionGoals,
  type NutritionGoals
} from "@/domain/nutritionGoals";

const store = createDocumentStore<NutritionGoals>(
  "lifequest.nutritionGoals.v1",
  isNutritionGoals,
  defaultNutritionGoals
);

export const nutritionGoalsStorageKey = store.storageKey;
export const loadNutritionGoals = store.load;
export const saveNutritionGoals = store.save;
