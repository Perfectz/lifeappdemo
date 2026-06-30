import { createLocalRepository, type LocalRepository } from "@/data/createLocalRepository";
import { isTimelineCheckin, type TimelineCheckin } from "@/domain/timelineMirror";

const storageKey = "lifequest.timelineCheckins.v1";

export type TimelineCheckinRepository = LocalRepository<TimelineCheckin>;

export function createTimelineCheckinRepository(storage: Storage): TimelineCheckinRepository {
  return createLocalRepository<TimelineCheckin>(storage, storageKey, isTimelineCheckin);
}

export const timelineCheckinStorageKey = storageKey;

/** Newest-first history. */
export function loadTimelineCheckins(): TimelineCheckin[] {
  if (typeof window === "undefined") return [];
  return createTimelineCheckinRepository(window.localStorage)
    .load()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function addTimelineCheckin(checkin: TimelineCheckin): void {
  if (typeof window === "undefined") return;
  const repo = createTimelineCheckinRepository(window.localStorage);
  const existing = repo.load();
  existing.push(checkin);
  repo.save(existing);
}

export function deleteTimelineCheckin(id: string): void {
  if (typeof window === "undefined") return;
  const repo = createTimelineCheckinRepository(window.localStorage);
  repo.save(repo.load().filter((c) => c.id !== id));
}
