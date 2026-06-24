import { createDocumentStore } from "@/data/createDocumentStore";
import { defaultHealthGoals, isHealthGoals, type HealthGoals } from "@/domain/healthGoals";

const store = createDocumentStore<HealthGoals>(
  "lifequest.healthGoals.v1",
  isHealthGoals,
  defaultHealthGoals
);

export const healthGoalsStorageKey = store.storageKey;
export const loadHealthGoals = store.load;
export const saveHealthGoals = store.save;
