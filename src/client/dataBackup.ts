export const backupSchemaVersion = 1;
export const backupAppId = "lifequest-os";

/**
 * Keys excluded from snapshots: sync metadata + local pre-pull backups. They
 * must never ride inside an exported/synced snapshot (the backups would bloat
 * and recursively nest the cloud blob).
 */
const EXCLUDED_PREFIX = "lifequest.sync.";

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

  const restoredKeys: string[] = [];
  try {
    // Remove LifeQuest keys absent from the backup so deletions propagate
    // instead of resurrecting across devices. Sync-internal keys (the excluded
    // prefix) are never part of a snapshot, so they're left untouched.
    // Collect first, then remove — deleting while indexing skips keys.
    const staleKeys: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key || !key.startsWith("lifequest.") || key.startsWith(EXCLUDED_PREFIX)) continue;
      if (!Object.prototype.hasOwnProperty.call(parsed.data, key)) staleKeys.push(key);
    }
    for (const key of staleKeys) storage.removeItem(key);

    for (const [key, value] of Object.entries(parsed.data)) {
      if (!key.startsWith("lifequest.") || key.startsWith(EXCLUDED_PREFIX)) continue;
      storage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
      restoredKeys.push(key);
    }
  } catch {
    return {
      ok: false,
      message: "Storage is full — couldn't write the full backup."
    };
  }

  return { ok: true, restoredKeys };
}
