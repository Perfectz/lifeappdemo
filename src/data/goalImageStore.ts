/**
 * On-device store for the user's goal / final-form image (their "Patrick 2.0"
 * picture) — the max-level avatar. Like progress photos, it's intimate and
 * stays in IndexedDB on the device only: never in git, never in the cloud
 * snapshot. Its own DB to avoid version coupling with the photo store.
 */

const DB_NAME = "lifequest-goal";
const DB_VERSION = 1;
const STORE = "images";
const KEY = "goal";

export const goalImageChangedEvent = "lifequest:goal-image-changed";

function indexedDBAvailable(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window && window.indexedDB !== null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!indexedDBAvailable()) {
      reject(new Error("IndexedDB is not available."));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the goal store."));
  });
}

function emitChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(goalImageChangedEvent));
  }
}

export async function loadGoalImage(): Promise<string | null> {
  if (!indexedDBAvailable()) return null;
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return null;
  }
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(KEY);
    request.onsuccess = () => resolve(typeof request.result === "string" ? request.result : null);
    request.onerror = () => resolve(null);
    tx.oncomplete = () => db.close();
  });
}

export async function saveGoalImage(dataUrl: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(dataUrl, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not save the goal image."));
  });
  db.close();
  emitChanged();
}

export async function clearGoalImage(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not clear the goal image."));
  });
  db.close();
  emitChanged();
}
