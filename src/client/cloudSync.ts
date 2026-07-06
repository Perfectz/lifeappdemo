import {
  backupAppId,
  backupSchemaVersion,
  exportAllData,
  importAllData,
  isSyncableKey,
  serializeBackup,
  type DataBackup,
  type ImportResult
} from "@/client/dataBackup";
import { emitSyncNotice } from "@/client/syncNotice";
import { dataChangedEventName, emitStorageError } from "@/data/createLocalRepository";
import {
  describeMergeLoss,
  mergeSnapshotData,
  type SnapshotData
} from "@/data/snapshotMerge";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Optional cloud backup/sync on top of the local-first store.
 *
 * Local storage stays the source of truth for instant reads. When the user
 * is signed in, we push a full snapshot (via the existing exportAllData
 * envelope) to a per-user row, and reconcile it on other devices.
 *
 * Concurrency and conflict handling:
 * - `updated_at` is server-authoritative (Postgres trigger/default sets it to
 *   now(); see supabase/server-updated-at.sql). The client never trusts its
 *   own clock for ordering — it only echoes back the value the server last
 *   returned, so a skewed device clock can't invert newer/older.
 * - Pushes are atomic conditional writes: UPDATE … WHERE updated_at =
 *   <last value we saw>, checking the affected row. Two devices racing can't
 *   silently clobber each other — the loser gets a conflict and reconciles.
 * - Conflicts are resolved by a per-storage-key merge (union collections by
 *   record id, newest updatedAt/recordedAt wins — see src/data/snapshotMerge),
 *   not by replacing either side wholesale. Anything a merge discards is
 *   surfaced to the user via a sync notice, and a timestamped local backup is
 *   stashed before local data is rewritten.
 */

const TABLE = "user_data";
const LAST_SYNCED_KEY = "lifequest.sync.lastSyncedAt";
const BACKUP_PREFIX = "lifequest.sync.localBackup.";
const MAX_BACKUPS = 3;
const PUSH_DEBOUNCE_MS = 2500;
const PULL_REFRESH_MARKER = "__cloud_pull__";
/** Postgres unique_violation — two devices raced to create the user's row. */
const UNIQUE_VIOLATION = "23505";

export type CloudUser = { id: string; email: string | null };
export type SyncResult<T> = ({ ok: true } & T) | { ok: false; message: string };
export type PushResult = { ok: true; at: string } | { ok: false; message: string; conflict?: boolean };

export type MergeReport = {
  /** Server updated_at of the cloud row we merged with (null when no row exists). */
  at: string | null;
  /** Local values discarded because a newer cloud version won. */
  localDiscarded: number;
  /** Cloud values discarded because a newer local version won. */
  cloudDiscarded: number;
  /** The merged result differs from the cloud row — push to converge. */
  cloudNeedsPush: boolean;
  /** Local storage was rewritten with merged data. */
  localChanged: boolean;
};

export const isCloudSyncConfigured = isSupabaseConfigured;

/**
 * Whether two timestamps refer to the same instant. The client stores the
 * server-returned `updated_at` verbatim, but formats can still differ across
 * paths ("…Z" vs "…+00:00"), so equality must compare instants, not strings.
 */
export function sameInstant(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const left = Date.parse(a);
  const right = Date.parse(b);
  if (Number.isNaN(left) || Number.isNaN(right)) return false;
  return left === right;
}

/** Last user observed by the auth subscription — avoids a network call per save. */
let cachedUser: CloudUser | null = null;

function storage(): Storage | null {
  return typeof window !== "undefined" ? window.localStorage : null;
}

function surfaceSyncError(message: string): void {
  emitStorageError("cloud sync", new Error(message));
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}

export function getLastSyncedAt(): string | null {
  return storage()?.getItem(LAST_SYNCED_KEY) ?? null;
}

function setLastSyncedAt(iso: string): void {
  storage()?.setItem(LAST_SYNCED_KEY, iso);
}

export async function getCurrentCloudUser(): Promise<CloudUser | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  const user = data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
  cachedUser = user;
  return user;
}

export async function sendMagicLink(email: string): Promise<SyncResult<unknown>> {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, message: "Cloud sync isn't configured." };
  const trimmed = email.trim();
  if (!trimmed) return { ok: false, message: "Enter your email address." };

  const emailRedirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}`
      : undefined;

  const { error } = await sb.auth.signInWithOtp({ email: trimmed, options: { emailRedirectTo } });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function signInWithGoogle(): Promise<SyncResult<unknown>> {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, message: "Sign-in isn't configured." };
  const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
  const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function signUpWithPassword(
  email: string,
  password: string
): Promise<SyncResult<{ needsConfirmation: boolean }>> {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, message: "Sign-up isn't configured." };
  if (!email.trim()) return { ok: false, message: "Enter your email address." };
  if (password.length < 6) return { ok: false, message: "Use a password of at least 6 characters." };

  const { data, error } = await sb.auth.signUp({ email: email.trim(), password });
  if (error) return { ok: false, message: error.message };
  return { ok: true, needsConfirmation: !data.session };
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<SyncResult<unknown>> {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, message: "Sign-in isn't configured." };
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function signOutCloud(): Promise<void> {
  await getSupabaseClient()?.auth.signOut();
  cachedUser = null;
}

export function subscribeAuthState(callback: (user: CloudUser | null) => void): () => void {
  const sb = getSupabaseClient();
  if (!sb) {
    callback(null);
    return () => {};
  }
  const { data } = sb.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ? { id: session.user.id, email: session.user.email ?? null } : null;
    cachedUser = user;
    callback(user);
  });
  return () => data.subscription.unsubscribe();
}

/** Stash a timestamped local snapshot before an overwrite; keep only the most recent few. */
function stashLocalBackup(store: Storage): boolean {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    store.setItem(`${BACKUP_PREFIX}${stamp}`, serializeBackup(exportAllData(store)));
    const keys: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key && key.startsWith(BACKUP_PREFIX)) keys.push(key);
    }
    keys.sort();
    while (keys.length > MAX_BACKUPS) {
      const oldest = keys.shift();
      if (oldest) store.removeItem(oldest);
    }
    return true;
  } catch {
    // Usually storage quota — the caller decides whether to proceed without it.
    return false;
  }
}

/** Drop all but the newest stashed backup to free quota for a stash retry. */
function pruneOldestBackups(store: Storage): void {
  // Collect first, then remove — deleting while indexing skips keys.
  const keys: string[] = [];
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i);
    if (key && key.startsWith(BACKUP_PREFIX)) keys.push(key);
  }
  keys.sort();
  for (const key of keys.slice(0, -1)) store.removeItem(key);
}

/** Stash a safety copy, pruning older stashes once to free quota if needed. */
function stashLocalBackupWithRetry(store: Storage): boolean {
  if (stashLocalBackup(store)) return true;
  pruneOldestBackups(store);
  return stashLocalBackup(store);
}

export function hasLocalBackup(): boolean {
  const store = storage();
  if (!store) return false;
  for (let i = 0; i < store.length; i += 1) {
    if (store.key(i)?.startsWith(BACKUP_PREFIX)) return true;
  }
  return false;
}

/** Restore the most recent pre-pull local backup (undo an unwanted cloud restore). */
export function restoreLatestLocalBackup(): SyncResult<{ restoredKeys: string[] }> {
  const store = storage();
  if (!store) return { ok: false, message: "Storage unavailable." };
  const keys: string[] = [];
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i);
    if (key && key.startsWith(BACKUP_PREFIX)) keys.push(key);
  }
  if (keys.length === 0) return { ok: false, message: "No local backup found." };
  keys.sort();
  const latest = store.getItem(keys[keys.length - 1]);
  if (!latest) return { ok: false, message: "Local backup was empty." };
  const result = importAllData(store, latest);
  if (!result.ok) return result;
  window.dispatchEvent(
    new CustomEvent(dataChangedEventName, { detail: { storageKey: PULL_REFRESH_MARKER } })
  );
  return { ok: true, restoredKeys: result.restoredKeys };
}

async function readRemoteUpdatedAt(
  userId: string
): Promise<{ exists: boolean; updatedAt: string | null }> {
  const sb = getSupabaseClient();
  if (!sb) return { exists: false, updatedAt: null };
  const { data, error } = await sb
    .from(TABLE)
    .select("updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return { exists: false, updatedAt: null };
  const updatedAt = (data as { updated_at?: unknown }).updated_at;
  return { exists: true, updatedAt: typeof updatedAt === "string" ? updatedAt : null };
}

function serverUpdatedAt(row: unknown, fallback: string): string {
  const value = (row as { updated_at?: unknown } | null)?.updated_at;
  return typeof value === "string" ? value : fallback;
}

/**
 * Push the full local snapshot up without ever clobbering a cloud row that
 * moved since we last saw it.
 *
 * - With a known `lastSyncedAt`, this is an atomic compare-and-swap: a single
 *   UPDATE … WHERE user_id = ? AND updated_at = <expected>. If zero rows
 *   match, another device advanced the row and we report a conflict instead
 *   of overwriting (the old read-then-upsert had a window where two devices
 *   could both pass the check and the second silently won).
 * - Without one (first sync from this device), we INSERT; a unique violation
 *   means another device created the row first → conflict, not overwrite.
 * - `updated_at` is set server-side (trigger/default → now()); the client
 *   payload value is only a fallback for databases missing the trigger. We
 *   always store the value the server returns, never our own clock.
 */
export async function pushSnapshot(): Promise<PushResult> {
  const sb = getSupabaseClient();
  const store = storage();
  if (!sb || !store) return { ok: false, message: "Cloud sync isn't configured." };
  const user = cachedUser ?? (await getCurrentCloudUser());
  if (!user) return { ok: false, message: "Sign in to back up." };

  const snapshot = exportAllData(store);
  // Fallback only: the server trigger overwrites this with now(). Kept so a
  // database without the trigger still advances updated_at on every write.
  const fallbackAt = new Date().toISOString();
  const expected = getLastSyncedAt();

  if (expected) {
    const { data, error } = await sb
      .from(TABLE)
      .update({ data: snapshot, updated_at: fallbackAt })
      .eq("user_id", user.id)
      .eq("updated_at", expected)
      .select("updated_at");
    if (error) return { ok: false, message: error.message };
    const rows = (data ?? []) as { updated_at?: unknown }[];
    if (rows.length > 0) {
      const at = serverUpdatedAt(rows[0], fallbackAt);
      setLastSyncedAt(at);
      return { ok: true, at };
    }
    // Zero rows matched: the row either moved (conflict) or was deleted.
    const remote = await readRemoteUpdatedAt(user.id);
    if (remote.exists) {
      return {
        ok: false,
        conflict: true,
        message: "Cloud has newer changes from another device."
      };
    }
    // Row vanished server-side — fall through and recreate it.
  }

  const { data: inserted, error: insertError } = await sb
    .from(TABLE)
    .insert({ user_id: user.id, data: snapshot, updated_at: fallbackAt })
    .select("updated_at")
    .single();
  if (insertError) {
    if (insertError.code === UNIQUE_VIOLATION) {
      return {
        ok: false,
        conflict: true,
        message: "Cloud already has data from another device."
      };
    }
    return { ok: false, message: insertError.message };
  }
  const at = serverUpdatedAt(inserted, fallbackAt);
  setLastSyncedAt(at);
  return { ok: true, at };
}

type CloudRow = { data: unknown; updatedAt: string | null };

async function fetchCloudRow(userId: string): Promise<SyncResult<{ row: CloudRow | null }>> {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, message: "Cloud sync isn't configured." };
  const { data, error } = await sb
    .from(TABLE)
    .select("data, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  const row = data as { data?: unknown; updated_at?: unknown } | null;
  if (!row || row.data == null) return { ok: true, row: null };
  return {
    ok: true,
    row: {
      data: row.data,
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : null
    }
  };
}

/** Extract the keyed snapshot map from a stored cloud envelope, or null. */
function cloudSnapshotData(raw: unknown): SnapshotData | null {
  let envelope: unknown = raw;
  if (typeof raw === "string") {
    try {
      envelope = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!envelope || typeof envelope !== "object") return null;
  const data = (envelope as { data?: unknown }).data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const filtered: SnapshotData = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (isSyncableKey(key)) filtered[key] = value;
  }
  return filtered;
}

/**
 * Reconcile local data with the cloud row by merging per storage key instead
 * of replacing either side (see src/data/snapshotMerge for the rules). Local
 * storage is rewritten only when the merge actually changed it, with a
 * timestamped safety stash first. Anything the merge discarded is announced
 * to the user via a sync notice.
 *
 * After a successful merge, `lastSyncedAt` equals the cloud row's server
 * `updated_at`, so a follow-up push (when `cloudNeedsPush` is true) passes
 * the conditional-write check unless another device raced again.
 */
export async function mergeWithCloud(): Promise<SyncResult<MergeReport>> {
  const store = storage();
  if (!store) return { ok: false, message: "Cloud sync isn't configured." };
  const user = cachedUser ?? (await getCurrentCloudUser());
  if (!user) return { ok: false, message: "Sign in to sync." };

  const fetched = await fetchCloudRow(user.id);
  if (!fetched.ok) return fetched;
  if (!fetched.row) {
    // Nothing in the cloud yet — the caller should push the local snapshot.
    return {
      ok: true,
      at: null,
      localDiscarded: 0,
      cloudDiscarded: 0,
      cloudNeedsPush: true,
      localChanged: false
    };
  }

  const cloudData = cloudSnapshotData(fetched.row.data);
  if (!cloudData) {
    return { ok: false, message: "Cloud backup is in an unrecognized format." };
  }

  const localEnvelope = exportAllData(store);
  const merged = mergeSnapshotData(localEnvelope.data, cloudData);

  if (merged.changedFromLocal) {
    // The stash is the only undo for the rewrite below; without it, abort.
    if (!stashLocalBackupWithRetry(store)) {
      return { ok: false, message: "Couldn't save a local safety copy — sync merge cancelled." };
    }
    const mergedEnvelope: DataBackup = {
      app: backupAppId,
      schemaVersion: backupSchemaVersion,
      exportedAt: new Date().toISOString(),
      data: merged.data
    };
    const result: ImportResult = importAllData(store, JSON.stringify(mergedEnvelope));
    if (!result.ok) return { ok: false, message: result.message };
    window.dispatchEvent(
      new CustomEvent(dataChangedEventName, { detail: { storageKey: PULL_REFRESH_MARKER } })
    );
  }

  const at = fetched.row.updatedAt;
  if (at) setLastSyncedAt(at);

  // A merge that discarded anything is a conflict resolution the user should
  // hear about — never resolve silently.
  const loss = describeMergeLoss(merged.stats);
  if (loss) emitSyncNotice(loss);

  return {
    ok: true,
    at,
    localDiscarded: merged.stats.localDiscarded,
    cloudDiscarded: merged.stats.cloudDiscarded,
    cloudNeedsPush: merged.changedFromCloud,
    localChanged: merged.changedFromLocal
  };
}

/**
 * Pull the cloud snapshot down, REPLACING local data (with a safety copy
 * first). This is the explicit "Restore from cloud" action — automatic sync
 * uses mergeWithCloud instead so nothing is lost silently.
 */
export async function pullSnapshot(): Promise<SyncResult<{ restoredKeys: string[]; at: string }>> {
  const sb = getSupabaseClient();
  const store = storage();
  if (!sb || !store) return { ok: false, message: "Cloud sync isn't configured." };
  const user = cachedUser ?? (await getCurrentCloudUser());
  if (!user) return { ok: false, message: "Sign in to restore." };

  const fetched = await fetchCloudRow(user.id);
  if (!fetched.ok) return fetched;
  if (!fetched.row) return { ok: false, message: "No cloud backup found yet." };

  // The stash is the only undo for the overwrite below. If it can't be written
  // (e.g. quota), free space by pruning old backups and retry once; if it still
  // fails, abort rather than replace local data without a safety copy.
  if (!stashLocalBackupWithRetry(store)) {
    return { ok: false, message: "Couldn't save a local safety copy — restore cancelled." };
  }

  const json =
    typeof fetched.row.data === "string" ? fetched.row.data : JSON.stringify(fetched.row.data);
  const result: ImportResult = importAllData(store, json);
  if (!result.ok) return { ok: false, message: result.message };

  const at = fetched.row.updatedAt ?? new Date().toISOString();
  setLastSyncedAt(at);
  window.dispatchEvent(
    new CustomEvent(dataChangedEventName, { detail: { storageKey: PULL_REFRESH_MARKER } })
  );
  return { ok: true, restoredKeys: result.restoredKeys, at };
}

let started = false;

/**
 * Wire up automatic sync for the session. Safe to call once on app mount;
 * no-ops when sync isn't configured. Returns a cleanup function.
 */
export function startCloudSync(): () => void {
  if (started || !isSupabaseConfigured() || typeof window === "undefined") {
    return () => {};
  }
  started = true;

  const sb = getSupabaseClient();
  if (!sb) {
    started = false;
    return () => {};
  }

  let pushTimer: ReturnType<typeof setTimeout> | null = null;
  let reconciling = false;

  /**
   * Push local data up. On conflict, merge with the cloud row (per-key,
   * union-by-id — never a wholesale replace) and retry the push once with the
   * refreshed `lastSyncedAt`. A second conflict means another device is
   * actively racing; defer to the next data change rather than loop.
   */
  const runPush = (afterMerge = false) => {
    pushSnapshot()
      .then((result) => {
        if (result.ok) return;
        if (result.conflict) {
          if (afterMerge) {
            surfaceSyncError(
              `Cloud backup deferred: ${result.message} It will retry on the next change.`
            );
            return;
          }
          mergeWithCloud()
            .then((mergedResult) => {
              if (!mergedResult.ok) {
                surfaceSyncError(`Cloud sync paused: ${mergedResult.message}`);
                return;
              }
              if (mergedResult.cloudNeedsPush) runPush(true);
            })
            .catch((error) => surfaceSyncError(`Cloud sync failed: ${describeError(error)}`));
          return;
        }
        surfaceSyncError(`Cloud backup failed: ${result.message}`);
      })
      .catch((error) => surfaceSyncError(`Cloud backup failed: ${describeError(error)}`));
  };

  const schedulePush = () => {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => runPush(), PUSH_DEBOUNCE_MS);
  };

  const onDataChanged = (event: Event) => {
    const detail = (event as CustomEvent).detail as { storageKey?: string } | undefined;
    if (detail?.storageKey === PULL_REFRESH_MARKER) return; // ignore our own post-pull refresh
    if (cachedUser) schedulePush(); // cached — no per-event network call
  };

  /**
   * Session-start reconcile: merge with whatever the cloud holds, then push
   * only if the merge produced something the cloud doesn't have. No client
   * clock ever decides direction — the merge is symmetric per record, and
   * ordering comes from per-record timestamps plus the server's updated_at
   * compare-and-swap on push.
   */
  const reconcile = async () => {
    if (reconciling) return;
    reconciling = true;
    try {
      const user = await getCurrentCloudUser();
      if (!user) return;
      const merged = await mergeWithCloud();
      if (!merged.ok) {
        surfaceSyncError(`Cloud sync failed: ${merged.message}`);
        return;
      }
      if (merged.cloudNeedsPush) runPush();
    } catch (error) {
      surfaceSyncError(`Cloud sync failed: ${describeError(error)}`);
    } finally {
      reconciling = false;
    }
  };

  window.addEventListener(dataChangedEventName, onDataChanged);
  void reconcile();

  const { data: sub } = sb.auth.onAuthStateChange((authEvent, session) => {
    cachedUser = session?.user
      ? { id: session.user.id, email: session.user.email ?? null }
      : null;
    if (!cachedUser && pushTimer) {
      // Signed out — drop any pending debounced push so it doesn't fire and
      // surface a "sign in to back up" error right after a deliberate sign-out.
      clearTimeout(pushTimer);
      pushTimer = null;
    }
    if (authEvent === "SIGNED_IN" || authEvent === "INITIAL_SESSION") {
      void reconcile();
    }
  });

  return () => {
    window.removeEventListener(dataChangedEventName, onDataChanged);
    sub.subscription.unsubscribe();
    if (pushTimer) clearTimeout(pushTimer);
    started = false;
  };
}
