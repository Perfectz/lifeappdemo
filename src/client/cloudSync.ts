import {
  exportAllData,
  importAllData,
  serializeBackup,
  type ImportResult
} from "@/client/dataBackup";
import { dataChangedEventName } from "@/data/createLocalRepository";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Optional cloud backup/sync on top of the local-first store.
 *
 * Local storage stays the source of truth for instant reads. When the user
 * is signed in, we push a full snapshot (via the existing exportAllData
 * envelope) to a per-user row, and pull it back on other devices. Conflict
 * strategy is last-write-wins by updated_at, with a local safety copy taken
 * before any overwrite.
 */

const TABLE = "user_data";
const LAST_SYNCED_KEY = "lifequest.sync.lastSyncedAt";
const PRE_PULL_BACKUP_KEY = "lifequest.sync.localBackupBeforePull";
const PUSH_DEBOUNCE_MS = 2500;
const PULL_REFRESH_MARKER = "__cloud_pull__";

export type CloudUser = { id: string; email: string | null };
export type SyncResult<T> = ({ ok: true } & T) | { ok: false; message: string };

export const isCloudSyncConfigured = isSupabaseConfigured;

function storage(): Storage | null {
  return typeof window !== "undefined" ? window.localStorage : null;
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
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
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

  const { error } = await sb.auth.signInWithOtp({
    email: trimmed,
    options: { emailRedirectTo }
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function signInWithGoogle(): Promise<SyncResult<unknown>> {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, message: "Sign-in isn't configured." };
  const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo }
  });
  // On success the browser navigates to Google; this line is reached only on error.
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
  // When email confirmation is required, no session is returned yet.
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
}

/** Subscribe to auth changes. Fires immediately is not guaranteed — pair with getCurrentCloudUser for the initial read. */
export function subscribeAuthState(callback: (user: CloudUser | null) => void): () => void {
  const sb = getSupabaseClient();
  if (!sb) {
    callback(null);
    return () => {};
  }
  const { data } = sb.auth.onAuthStateChange((_event, session) => {
    callback(
      session?.user ? { id: session.user.id, email: session.user.email ?? null } : null
    );
  });
  return () => data.subscription.unsubscribe();
}

/** Push the full local snapshot up to the user's cloud row. */
export async function pushSnapshot(): Promise<SyncResult<{ at: string }>> {
  const sb = getSupabaseClient();
  const store = storage();
  if (!sb || !store) return { ok: false, message: "Cloud sync isn't configured." };
  const user = await getCurrentCloudUser();
  if (!user) return { ok: false, message: "Sign in to back up." };

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
  const user = await getCurrentCloudUser();
  if (!user) return { ok: false, message: "Sign in to restore." };

  const { data, error } = await sb
    .from(TABLE)
    .select("data, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };

  const row = data as { data?: unknown; updated_at?: unknown } | null;
  if (!row || !row.data) return { ok: false, message: "No cloud backup found yet." };

  // Safety net: keep a copy of what was here before we overwrite it.
  try {
    store.setItem(PRE_PULL_BACKUP_KEY, serializeBackup(exportAllData(store)));
  } catch {
    // best-effort; never block a restore on the safety copy
  }

  const json = typeof row.data === "string" ? row.data : JSON.stringify(row.data);
  const result: ImportResult = importAllData(store, json);
  if (!result.ok) return { ok: false, message: result.message };

  const at = typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString();
  setLastSyncedAt(at);
  // Refresh every live screen (hero card, nav, current page).
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

  const schedulePush = () => {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      void pushSnapshot();
    }, PUSH_DEBOUNCE_MS);
  };

  const onDataChanged = (event: Event) => {
    const detail = (event as CustomEvent).detail as { storageKey?: string } | undefined;
    // Ignore the refresh we dispatch right after a pull (avoids echo push).
    if (detail?.storageKey === PULL_REFRESH_MARKER) return;
    void (async () => {
      if (await getCurrentCloudUser()) schedulePush();
    })();
  };

  // On startup / sign-in, decide whether this device should pull or push.
  const reconcile = async () => {
    const user = await getCurrentCloudUser();
    if (!user) return;
    const { data } = await sb
      .from(TABLE)
      .select("updated_at")
      .eq("user_id", user.id)
      .maybeSingle();
    const row = data as { updated_at?: unknown } | null;

    if (!row) {
      // No cloud row yet — seed it from this device.
      void pushSnapshot();
      return;
    }

    const remoteAt = typeof row.updated_at === "string" ? Date.parse(row.updated_at) : NaN;
    const localStamp = getLastSyncedAt();
    const localAt = localStamp ? Date.parse(localStamp) : NaN;

    if (Number.isNaN(localAt) || (Number.isFinite(remoteAt) && remoteAt > localAt)) {
      // This device never synced, or the cloud is newer — pull it down.
      void pullSnapshot();
    } else {
      void pushSnapshot();
    }
  };

  window.addEventListener(dataChangedEventName, onDataChanged);
  void reconcile();

  const { data: sub } = sb.auth.onAuthStateChange((authEvent) => {
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
