export const backupSchemaVersion = 1;
export const backupAppId = "lifequest-os";

/**
 * Keys excluded from snapshots: sync metadata + local pre-pull backups. They
 * must never ride inside an exported/synced snapshot (the backups would bloat
 * and recursively nest the cloud blob).
 */
const EXCLUDED_PREFIX = "lifequest.sync.";

/** Whether a storage key participates in backups/sync (LifeQuest data, not sync metadata). */
export function isSyncableKey(key: string): boolean {
  return key.startsWith("lifequest.") && !key.startsWith(EXCLUDED_PREFIX);
}

export type DataBackup = {
  app: typeof backupAppId;
  schemaVersion: number;
  exportedAt: string;
  data: Record<string, unknown>;
};

export type ImportResult =
  | { ok: true; restoredKeys: string[] }
  | { ok: false; message: string };

/**
 * Snapshot every LifeQuest key into a portable JSON envelope. Generic
 * over keys so new entity types are included automatically without
 * touching this code.
 */
export function exportAllData(storage: Storage): DataBackup {
  const data: Record<string, unknown> = {};
  // Single pass over storage keys — no separate byte-size scan.
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key || !key.startsWith("lifequest.") || key.startsWith(EXCLUDED_PREFIX)) continue;
    const raw = storage.getItem(key);
    if (raw == null) continue;
    try {
      data[key] = JSON.parse(raw);
    } catch {
      // Preserve non-JSON values verbatim.
      data[key] = raw;
    }
  }
  return {
    app: backupAppId,
    schemaVersion: backupSchemaVersion,
    exportedAt: new Date().toISOString(),
    data
  };
}

export function serializeBackup(backup: DataBackup): string {
  return JSON.stringify(backup, null, 2);
}

export function backupFileName(now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `lifequest-backup-${stamp}.json`;
}

function isBackup(value: unknown): value is DataBackup {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DataBackup>;
  return (
    candidate.app === backupAppId &&
    typeof candidate.schemaVersion === "number" &&
    typeof candidate.data === "object" &&
    candidate.data !== null &&
    !Array.isArray(candidate.data)
  );
}

/**
 * Restore a backup, replacing every LifeQuest key it contains and removing
 * LifeQuest keys it doesn't (so deletions don't resurrect). Only keys under
 * the `lifequest.` namespace are touched, so a malformed or malicious file
 * can't scribble into unrelated storage.
 *
 * The restore is all-or-nothing: if any write fails (typically storage
 * quota), every LifeQuest key is rolled back to its pre-import value. A
 * partial restore would leave a mixed local/imported state that cloud sync
 * would then push back up as if it were real data.
 */
export function importAllData(storage: Storage, rawJson: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false, message: "That file isn't valid JSON." };
  }

  if (!isBackup(parsed)) {
    return {
      ok: false,
      message: "That doesn't look like a LifeQuest backup file."
    };
  }

  // Capture the pre-import state of every key we might touch, so a mid-write
  // failure can be rolled back instead of leaving a half-imported store.
  const previous = new Map<string, string>();
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key || !key.startsWith("lifequest.") || key.startsWith(EXCLUDED_PREFIX)) continue;
    const value = storage.getItem(key);
    if (value != null) previous.set(key, value);
  }

  const restoredKeys: string[] = [];
  try {
    // Remove LifeQuest keys absent from the backup so deletions propagate
    // instead of resurrecting across devices. Sync-internal keys (the excluded
    // prefix) are never part of a snapshot, so they're left untouched.
    for (const key of previous.keys()) {
      if (!Object.prototype.hasOwnProperty.call(parsed.data, key)) storage.removeItem(key);
    }

    for (const [key, value] of Object.entries(parsed.data)) {
      if (!key.startsWith("lifequest.") || key.startsWith(EXCLUDED_PREFIX)) continue;
      storage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
      restoredKeys.push(key);
    }
  } catch {
    rollbackImport(storage, previous);
    return {
      ok: false,
      message: "Storage is full — the restore was rolled back and nothing was changed."
    };
  }

  return { ok: true, restoredKeys };
}

/** Best-effort restore of the pre-import state after a failed import. */
function rollbackImport(storage: Storage, previous: Map<string, string>): void {
  try {
    // Clear partial writes first so the originals (which fit before) have room.
    // Collect first, then remove — deleting while indexing skips keys.
    const currentKeys: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key || !key.startsWith("lifequest.") || key.startsWith(EXCLUDED_PREFIX)) continue;
      currentKeys.push(key);
    }
    for (const key of currentKeys) storage.removeItem(key);
    for (const [key, value] of previous) storage.setItem(key, value);
  } catch {
    // Rolling back re-writes data that fit before the import, so this should
    // not throw; if it somehow does, there is nothing safer left to try.
  }
}
