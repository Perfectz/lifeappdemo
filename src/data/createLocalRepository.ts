export type TypeGuard<T> = (value: unknown) => value is T;

/**
 * A migration that pulls records from an older storage key into the
 * current one. Migrations run lazily on first load when the current key
 * is empty but a legacy key still holds data, so evolving the schema
 * never silently drops history.
 */
export type RepositoryMigration<T> = {
  fromKey: string;
  migrate(legacy: unknown[]): T[];
};

export type LocalRepository<T> = {
  readonly storageKey: string;
  load(): T[];
  save(items: T[]): void;
};

export const storageErrorEventName = "lifequest:storage-error";

/**
 * Dispatched after any successful repository write. The browser's native
 * `storage` event only fires across tabs, so this is how same-tab
 * consumers (the shell's hero card, nav status pulses) stay live when
 * the user completes a quest or logs a metric without navigating.
 */
export const dataChangedEventName = "lifequest:data-changed";

export type StorageErrorDetail = {
  storageKey: string;
  message: string;
};

function describeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "QuotaExceededError" || /quota/i.test(error.message)) {
      return "Storage is full. Export your data and clear space to keep saving.";
    }
    return error.message;
  }
  return "Unknown storage error.";
}

/**
 * Surface a write failure without throwing into UI event handlers
 * (which would silently reject). We log it and dispatch a window event
 * so a single listener can show the user a banner — strictly better
 * than today's silent data loss.
 */
export function emitStorageError(storageKey: string, error: unknown): void {
  const detail: StorageErrorDetail = { storageKey, message: describeError(error) };
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(storageErrorEventName, { detail }));
  }
  console.error(`LifeQuest: failed to persist "${storageKey}"`, error);
}

export function createLocalRepository<T>(
  storage: Storage,
  storageKey: string,
  guard: TypeGuard<T>,
  migrations: RepositoryMigration<T>[] = []
): LocalRepository<T> {
  function readKey(key: string): unknown[] | null {
    let raw: string | null;
    try {
      raw = storage.getItem(key);
    } catch {
      return null;
    }
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return {
    storageKey,
    load() {
      const current = readKey(storageKey);
      if (current) {
        const kept = current.filter(guard);
        const dropped = current.length - kept.length;
        if (dropped > 0) {
          // Don't silently evaporate history — make data loss observable.
          console.warn(
            `LifeQuest: dropped ${dropped} unreadable record(s) from "${storageKey}" on load.`
          );
        }
        return kept;
      }

      // Current key empty/corrupt — attempt migration from a legacy key.
      for (const migration of migrations) {
        const legacy = readKey(migration.fromKey);
        if (legacy && legacy.length > 0) {
          const migrated = migration.migrate(legacy).filter(guard);
          // Persist forward so the migration only runs once.
          try {
            storage.setItem(storageKey, JSON.stringify(migrated));
          } catch (error) {
            emitStorageError(storageKey, error);
          }
          return migrated;
        }
      }

      return [];
    },
    save(items) {
      try {
        storage.setItem(storageKey, JSON.stringify(items));
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent(dataChangedEventName, { detail: { storageKey } })
          );
        }
      } catch (error) {
        emitStorageError(storageKey, error);
      }
    }
  };
}

/** Bytes consumed by all LifeQuest keys, plus a rough per-key breakdown. */
export function getLifeQuestStorageUsage(storage: Storage): {
  totalBytes: number;
  byKey: { key: string; bytes: number }[];
} {
  const byKey: { key: string; bytes: number }[] = [];
  let totalBytes = 0;
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key || !key.startsWith("lifequest.")) continue;
      const value = storage.getItem(key) ?? "";
      // UTF-16 code units → ~2 bytes each is the common rough estimate.
      const bytes = (key.length + value.length) * 2;
      byKey.push({ key, bytes });
      totalBytes += bytes;
    }
  } catch {
    // Storage unavailable — report zero rather than throwing.
  }
  byKey.sort((a, b) => b.bytes - a.bytes);
  return { totalBytes, byKey };
}
