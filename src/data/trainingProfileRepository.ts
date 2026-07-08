import { createDocumentStore } from "@/data/createDocumentStore";
import {
  defaultTrainingProfile,
  isTrainingProfile,
  type TrainingProfile
} from "@/domain/trainingProfile";

const store = createDocumentStore<TrainingProfile>(
  "lifequest.training-profile.v1",
  isTrainingProfile,
  defaultTrainingProfile
);

export const trainingProfileStorageKey = store.storageKey;
export const loadTrainingProfile = store.load;
export const saveTrainingProfile = store.save;
