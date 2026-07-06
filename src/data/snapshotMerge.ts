/**
 * Per-storage-key merge of two LifeQuest snapshots (this device vs cloud).
 *
 * Replaces whole-snapshot last-writer-wins with record-level reconciliation:
 * - Collections (arrays of `{ id: string }` records — everything produced by
 *   createLocalRepository) are unioned by id; when both sides hold the same
 *   record, the copy with the newest `updatedAt`/`recordedAt`/`createdAt` wins.
 * - Documents (single objects from createDocumentStore) are compared by their
 *   `updatedAt` stamp; the newer one wins.
 * - Keys present on only one side are kept (union). This means record/key
 *   deletions can resurrect after a merge — the explicit "Restore from cloud"
 *   replace path still exists for a true replace.
 * - When neither side carries a usable timestamp and the values differ, the
 *   local copy wins (local-first: the device in hand is what the user sees),
 *   and the loss is counted so the caller can tell the user.
 *
 * Everything a merge throws away is tallied in SnapshotMergeStats so callers
 * can surface a user-visible notice instead of losing data silently.
 *
 * Equality is key-order-insensitive: cloud snapshots round-trip through
 * Postgres jsonb, which does not preserve object key order, so a naive
 * JSON.stringify comparison would report phantom differences on every sync.
 */

export type SnapshotData = Record<string, unknown>;

export type SnapshotMergeStats = {
  /** Local records/values discarded because a differing newer cloud copy won. */
  localDiscarded: number;
  /** Cloud records/values discarded because a differing newer local copy won. */
  cloudDiscarded: number;
  /** Storage keys where the two sides differed and had to be reconciled. */
  conflictKeys: string[];
};

export type SnapshotMergeResult = {
  data: SnapshotData;
  stats: SnapshotMergeStats;
  /** Merged output differs from the cloud side — a push is needed to converge. */
  changedFromCloud: boolean;
  /** Merged output differs from the local side — a local import is needed. */
  changedFromLocal: boolean;
};

/** JSON stringify with recursively sorted object keys, for stable comparison. */
export function canonicalStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortValue(record[key]);
    }
    return sorted;
  }
  return value;
}

function sameValue(a: unknown, b: unknown): boolean {
  return canonicalStringify(a) === canonicalStringify(b);
}

type IdRecord = Record<string, unknown> & { id: string };

function isIdRecord(value: unknown): value is IdRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { id?: unknown }).id === "string"
  );
}

function isIdRecordArray(value: unknown): value is IdRecord[] {
  return Array.isArray(value) && value.every(isIdRecord);
}

/**
 * Millisecond recency of a record, from the first parseable of
 * `updatedAt` → `recordedAt` → `createdAt`. Null when none parse.
 */
function recencyOf(value: unknown): number | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  for (const field of ["updatedAt", "recordedAt", "createdAt"]) {
    const stamp = record[field];
    if (typeof stamp === "string") {
      const parsed = Date.parse(stamp);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return null;
}

/**
 * True when the cloud copy should win over the local copy. Newest timestamp
 * wins; a timestamped copy beats an untimestamped one; full ties keep local
 * (local-first — the merged result is pushed back up anyway).
 */
function cloudWins(local: unknown, cloud: unknown): boolean {
  const localAt = recencyOf(local);
  const cloudAt = recencyOf(cloud);
  if (cloudAt === null) return false;
  if (localAt === null) return true;
  return cloudAt > localAt;
}

function mergeCollections(
  local: IdRecord[],
  cloud: IdRecord[],
  stats: SnapshotMergeStats
): IdRecord[] {
  const cloudById = new Map<string, IdRecord>();
  for (const record of cloud) cloudById.set(record.id, record);

  const merged: IdRecord[] = [];
  const seen = new Set<string>();

  for (const localRecord of local) {
    if (seen.has(localRecord.id)) {
      // Defensive: duplicate local ids — keep the first occurrence only.
      continue;
    }
    seen.add(localRecord.id);
    const cloudRecord = cloudById.get(localRecord.id);
    if (!cloudRecord || sameValue(localRecord, cloudRecord)) {
      merged.push(localRecord);
      continue;
    }
    if (cloudWins(localRecord, cloudRecord)) {
      stats.localDiscarded += 1;
      merged.push(cloudRecord);
    } else {
      stats.cloudDiscarded += 1;
      merged.push(localRecord);
    }
  }

  // Records only the cloud knows about (created on another device, or deleted
  // here — union semantics resurrect them; see module comment).
  for (const cloudRecord of cloud) {
    if (!seen.has(cloudRecord.id)) {
      seen.add(cloudRecord.id);
      merged.push(cloudRecord);
    }
  }

  return merged;
}

/** Merge a single storage key's value. */
function mergeKey(local: unknown, cloud: unknown, stats: SnapshotMergeStats): unknown {
  if (sameValue(local, cloud)) return local;

  if (isIdRecordArray(local) && isIdRecordArray(cloud)) {
    return mergeCollections(local, cloud, stats);
  }

  // Documents and anything else: whole-value newest-wins.
  if (cloudWins(local, cloud)) {
    stats.localDiscarded += 1;
    return cloud;
  }
  stats.cloudDiscarded += 1;
  return local;
}

export function mergeSnapshotData(local: SnapshotData, cloud: SnapshotData): SnapshotMergeResult {
  const stats: SnapshotMergeStats = { localDiscarded: 0, cloudDiscarded: 0, conflictKeys: [] };
  const data: SnapshotData = {};

  const keys = new Set<string>([...Object.keys(local), ...Object.keys(cloud)]);
  for (const key of keys) {
    const inLocal = Object.prototype.hasOwnProperty.call(local, key);
    const inCloud = Object.prototype.hasOwnProperty.call(cloud, key);
    if (inLocal && !inCloud) {
      data[key] = local[key];
      continue;
    }
    if (!inLocal && inCloud) {
      data[key] = cloud[key];
      continue;
    }
    const before = { local: stats.localDiscarded, cloud: stats.cloudDiscarded };
    const same = sameValue(local[key], cloud[key]);
    data[key] = same ? local[key] : mergeKey(local[key], cloud[key], stats);
    if (
      !same &&
      (stats.localDiscarded > before.local || stats.cloudDiscarded > before.cloud)
    ) {
      stats.conflictKeys.push(key);
    }
  }

  return {
    data,
    stats,
    changedFromCloud: !sameValue(data, cloud),
    changedFromLocal: !sameValue(data, local)
  };
}

/**
 * Human-readable summary of what a merge threw away, or null when nothing
 * was discarded. Used for the user-visible sync notice.
 */
export function describeMergeLoss(stats: SnapshotMergeStats): string | null {
  const parts: string[] = [];
  if (stats.localDiscarded > 0) {
    const one = stats.localDiscarded === 1;
    parts.push(
      `${stats.localDiscarded} older item${one ? "" : "s"} on this device ` +
        `${one ? "was" : "were"} replaced by newer versions from another device`
    );
  }
  if (stats.cloudDiscarded > 0) {
    const one = stats.cloudDiscarded === 1;
    parts.push(
      `${stats.cloudDiscarded} older cloud item${one ? "" : "s"} ` +
        `${one ? "was" : "were"} replaced by this device's newer versions`
    );
  }
  if (parts.length === 0) return null;
  return `Sync merged changes from another device: ${parts.join("; ")}. ` +
    "A local backup from before the merge is available under Settings → Cloud sync.";
}
