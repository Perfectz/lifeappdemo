/**
 * On-device image store for Timeline Mirror — reference images (baseline /
 * ideal / warning) and check-in photos. Like the progress photos and goal
 * image, these are intimate physique/face photos, so the bytes live ONLY in
 * IndexedDB on this device: never in git, never in the cloud snapshot. The
 * Supabase tables hold metadata + scores, not the image bytes (hybrid model).
 *
 * Keyed by an arbitrary string id so a single store holds many images.
 */

const DB_NAME = "lifequest-timeline-mirror";
const DB_VERSION = 1;
const STORE = "images";

export const timelineImageChangedEvent = "lifequest:timeline-image-changed";

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
    request.onerror = () => reject(request.error ?? new Error("Could not open the image store."));
  });
}

function emitChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(timelineImageChangedEvent));
  }
}

export async function loadTimelineImage(id: string): Promise<string | null> {
  if (!indexedDBAvailable()) return null;
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return null;
  }
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(id);
    request.onsuccess = () => resolve(typeof request.result === "string" ? request.result : null);
    request.onerror = () => resolve(null);
    tx.oncomplete = () => db.close();
  });
}

/** Load several images at once; missing ids resolve to null. */
export async function loadTimelineImages(ids: string[]): Promise<Record<string, string | null>> {
  const entries = await Promise.all(
    ids.map(async (id) => [id, await loadTimelineImage(id)] as const)
  );
  return Object.fromEntries(entries);
}

export async function saveTimelineImage(id: string, dataUrl: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(dataUrl, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not save the image."));
  });
  db.close();
  emitChanged();
}

export async function deleteTimelineImage(id: string): Promise<void> {
  if (!indexedDBAvailable()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not delete the image."));
  });
  db.close();
  emitChanged();
}
