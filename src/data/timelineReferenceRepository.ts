import { createLocalRepository, type LocalRepository } from "@/data/createLocalRepository";
import { isTimelineReferenceImage, type TimelineReferenceImage } from "@/domain/timelineMirror";

const storageKey = "lifequest.timelineReferenceImages.v1";

export type TimelineReferenceRepository = LocalRepository<TimelineReferenceImage>;

export function createTimelineReferenceRepository(storage: Storage): TimelineReferenceRepository {
  return createLocalRepository<TimelineReferenceImage>(
    storage,
    storageKey,
    isTimelineReferenceImage
  );
}

export const timelineReferenceStorageKey = storageKey;

/** Convenience reader using window.localStorage; returns [] off the browser. */
export function loadTimelineReferences(): TimelineReferenceImage[] {
  if (typeof window === "undefined") return [];
  return createTimelineReferenceRepository(window.localStorage).load();
}

export function saveTimelineReferences(items: TimelineReferenceImage[]): void {
  if (typeof window === "undefined") return;
  createTimelineReferenceRepository(window.localStorage).save(items);
}
