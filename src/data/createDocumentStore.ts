import { dataChangedEventName, emitStorageError, type TypeGuard } from "@/data/createLocalRepository";

/**
 * A persisted single-object "document" capability (vs. a collection, which uses
 * createLocalRepository). One factory for every settings/profile/goals blob, so
 * each capability is declared in a single line and they all share identical
 * load/validate/fallback + write/dispatch/error-handling behavior.
 *
 * APIE mapping:
 * - Encapsulation: parse/guard/fallback + persist/dispatch/error are hidden here.
 * - Abstraction:   callers depend on the DocumentStore<T> shape, not localStorage.
 * - Polymorphism:  every document store has the same interface, so generic code
 *                  (export, sync, future backends) treats them uniformly.
 * - "Inheritance": specialization is by composition — a concrete store is this
 *                  factory bound to a key + guard + default.
 */
export type DocumentStore<T> = {
  readonly storageKey: string;
  load(storage: Storage): T;
  save(storage: Storage, value: T): void;
};

export function createDocumentStore<T>(
  storageKey: string,
  isValid: TypeGuard<T>,
  fallback: () => T
): DocumentStore<T> {
  return {
    storageKey,
    load(storage: Storage): T {
      try {
        const raw = storage.getItem(storageKey);
        if (!raw) return fallback();
        const parsed: unknown = JSON.parse(raw);
        return isValid(parsed) ? parsed : fallback();
      } catch {
        return fallback();
      }
    },
    save(storage: Storage, value: T): void {
      try {
        storage.setItem(storageKey, JSON.stringify(value));
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(dataChangedEventName, { detail: { storageKey } }));
        }
      } catch (error) {
        emitStorageError(storageKey, error);
      }
    }
  };
}
