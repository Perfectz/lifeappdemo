import {
  exportAllData,
  importAllData,
  serializeBackup,
  type ImportResult
} from "@/client/dataBackup";
import { dataChangedEventName, emitStorageError } from "@/data/createLocalRepository";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Optional cloud backup/sync on top of the local-first store.
 *
 * Local storage stays the source of truth for instant reads. When the user
 * is signed in, we push a full snapshot (via the existing exportAllData
 * envelope) to a per-user row, and pull it back on other devices.
 *
 * Conflict handling: pushes use an optimistic-concurrency check — if the cloud
 * row moved since our last sync (another device wrote), we do NOT overwrite it;
 * we pull instead, after stashing a timestamped local backup. That makes the
 * worst case "remote wins, local recoverable" rather than "silent loss."
 */

const TABLE = "user_data";
const LAST_SYNCED_KEY = "lifequest.sync.lastSyncedAt";
const BACKUP_PREFIX = "lifequest.sync.localBackup.";
const MAX_BACKUPS = 3;
const PUSH_DEBOUNCE_MS = 2500;
const PULL_REFRESH_MARKER = "__cloud_pull__";

export type CloudUser = { id: string; email: string | null };
export type SyncResult<T> = ({ ok: true } & T) | { ok: false; message: string };
export type PushResult = { ok: true; at: string } | { ok: false; message: string; conflict?: boolean };

export const isCloudSyncConfigured = isSupabaseConfigured;

/**
 * Whether two timestamps refer to the same instant. Critical for the push
 * conflict check: we store `new Date().toISOString()` ("…Z") but Postgres/
 * PostgREST returns the same value formatted differently ("…+00:00"). A naive
 * string compare treats those as different and triggers a phantom conflict on
 * every save — which then pulls the cloud snapshot and reverts the local edit.
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

/** Push the full local snapshot up, refusing to overwrite a newer cloud row. */
export async function pushSnapshot(): Promise<PushResult> {
  const sb = getSupabaseClient();
  const store = storage();
  if (!sb || !store) return { ok: false, message: "Cloud sync isn't configured." };
  const user = cachedUser ?? (await getCurrentCloudUser());
  if (!user) return { ok: false, message: "Sign in to back up." };

  // Optimistic concurrency: don't clobber a cloud row another device advanced.
  const expected = getLastSyncedAt();
  if (expected) {
    const remote = await readRemoteUpdatedAt(user.id);
    // Compare by instant, not string: the cloud row formats the timestamp
    // differently ("+00:00") than our stored "Z", so a string compare would
    // flag a phantom conflict on every save and revert the local edit.
    if (remote.exists && remote.updatedAt && !sameInstant(remote.updatedAt, expected)) {
      return {
        ok: false,
        conflict: true,
        message: "Cloud has newer changes from another device."
      };
    }
  }

  const snapshot = exportAllData(store);
  const at = new Date().toISOString();
  const { error } = await sb
    .from(TABLE)
    .upsert({ user_id: user.id, data: snapshot, updated_at: at }, { onConflict: "user_id" });
  if (error) return { ok: false, message: error.message };

  setLastSyncedAt(at);
  return { ok: true, at };
}

/** Pull the cloud snapshot down, replacing local data (with a safety copy first). */
export async function pullSnapshot(): Promise<SyncResult<{ restoredKeys: string[]; at: string }>> {
  const sb = getSupabaseClient();
  const store = storage();
  if (!sb || !store) return { ok: false, message: "Cloud sync isn't configured." };
  const user = cachedUser ?? (await getCurrentCloudUser());
  if (!user) return { ok: false, message: "Sign in to restore." };

  const { data, error } = await sb
    .from(TABLE)
    .select("data, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };

  const row = data as { data?: unknown; updated_at?: unknown } | null;
  if (!row || !row.data) return { ok: false, message: "No cloud backup found yet." };

  // The stash is the only undo for the overwrite below. If it can't be written
  // (e.g. quota), free space by pruning old backups and retry once; if it still
  // fails, abort rather than replace local data without a safety copy.
  if (!stashLocalBackup(store)) {
    pruneOldestBackups(store);
    if (!stashLocalBackup(store)) {
      return { ok: false, message: "Couldn't save a local safety copy — restore cancelled." };
    }
  }

  const json = typeof row.data === "string" ? row.data : JSON.stringify(row.data);
  const result: ImportResult = importAllData(store, json);
  if (!result.ok) return { ok: false, message: result.message };

  const at = typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString();
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

  const runPush = () => {
    pushSnapshot()
      .then((result) => {
        if (result.ok) return;
        if (result.conflict) {
          // Another device advanced the cloud — pull it (local is stashed first).
          pullSnapshot()
            .then((pulled) => {
              if (!pulled.ok) surfaceSyncError(`Cloud sync paused: ${pulled.message}`);
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
    pushTimer = setTimeout(runPush, PUSH_DEBOUNCE_MS);
  };

  const onDataChanged = (event: Event) => {
    const detail = (event as CustomEvent).detail as { storageKey?: string } | undefined;
    if (detail?.storageKey === PULL_REFRESH_MARKER) return; // ignore our own post-pull refresh
    if (cachedUser) schedulePush(); // cached — no per-event network call
  };

  const reconcile = async () => {
    if (reconciling) return;
    reconciling = true;
    try {
      const user = await getCurrentCloudUser();
      if (!user) return;
      const remote = await readRemoteUpdatedAt(user.id);
      if (!remote.exists) {
        runPush();
        return;
      }
      const remoteAt = remote.updatedAt ? Date.parse(remote.updatedAt) : NaN;
      const localStamp = getLastSyncedAt();
      const localAt = localStamp ? Date.parse(localStamp) : NaN;
      if (Number.isNaN(localAt) || (Number.isFinite(remoteAt) && remoteAt > localAt)) {
        const pulled = await pullSnapshot();
        if (!pulled.ok) surfaceSyncError(`Cloud restore failed: ${pulled.message}`);
      } else {
        runPush();
      }
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
