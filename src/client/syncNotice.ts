/**
 * User-visible cloud-sync notices (distinct from storage *errors*).
 *
 * Whenever conflict resolution discards anything — e.g. an older local edit
 * loses to a newer version from another device — sync emits one of these so
 * a banner can tell the user, instead of resolving silently. Kept in its own
 * tiny module so UI components can listen without importing the Supabase
 * client that cloudSync.ts drags in.
 */

export const syncNoticeEventName = "lifequest:sync-notice";

export type SyncNoticeDetail = {
  message: string;
};

export function emitSyncNotice(message: string): void {
  if (typeof window === "undefined") return;
  const detail: SyncNoticeDetail = { message };
  window.dispatchEvent(new CustomEvent(syncNoticeEventName, { detail }));
  console.info(`LifeQuest sync: ${message}`);
}
