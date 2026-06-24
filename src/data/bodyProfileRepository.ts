import { createDocumentStore } from "@/data/createDocumentStore";
import { emptyBodyProfile, isBodyProfile, type BodyProfile } from "@/domain/bodyProfile";

const store = createDocumentStore<BodyProfile>(
  "lifequest.bodyProfile.v1",
  isBodyProfile,
  emptyBodyProfile
);

export const bodyProfileStorageKey = store.storageKey;
export const loadBodyProfile = store.load;
export const saveBodyProfile = store.save;
