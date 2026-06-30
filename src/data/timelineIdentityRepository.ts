import { createLocalRepository, type LocalRepository } from "@/data/createLocalRepository";
import {
  isTimelineIdentityDoc,
  type TimelineIdentityDoc,
  type TimelineIdentityDocType
} from "@/domain/timelineMirror";

const storageKey = "lifequest.timelineIdentityDocs.v1";

export type TimelineIdentityRepository = LocalRepository<TimelineIdentityDoc>;

export function createTimelineIdentityRepository(storage: Storage): TimelineIdentityRepository {
  return createLocalRepository<TimelineIdentityDoc>(storage, storageKey, isTimelineIdentityDoc);
}

export const timelineIdentityStorageKey = storageKey;

export function loadTimelineIdentityDocs(): TimelineIdentityDoc[] {
  if (typeof window === "undefined") return [];
  return createTimelineIdentityRepository(window.localStorage).load();
}

export function getTimelineIdentityDoc(
  docType: TimelineIdentityDocType
): TimelineIdentityDoc | undefined {
  return loadTimelineIdentityDocs().find((doc) => doc.docType === docType);
}

/** Insert-or-update the single doc of each type (one ideal + one warning). */
export function upsertTimelineIdentityDoc(doc: TimelineIdentityDoc): void {
  if (typeof window === "undefined") return;
  const repo = createTimelineIdentityRepository(window.localStorage);
  const existing = repo.load();
  const next = existing.filter((d) => d.docType !== doc.docType);
  next.push(doc);
  repo.save(next);
}
