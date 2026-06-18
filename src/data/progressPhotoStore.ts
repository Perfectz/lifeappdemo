import { isProgressPhoto, type ProgressPhoto } from "@/domain/progressPhotos";

/**
 * On-device IndexedDB store for progress photos. Deliberately separate from the
 * localStorage repositories AND from the cloud snapshot: progress photos are
 * large and intimate, so they never leave the device automatically. localStorage
 * (≈5MB) is far too small for image data; IndexedDB comfortably holds years of
 * downscaled JPEGs.
 */

const DB_NAME = "lifequest-media";
const DB_VERSION = 1;
const STORE = "progressPhotos";

export const progressPhotoChangedEvent = "lifequest:progress-photos-changed";

function indexedDBAvailable(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window && window.indexedDB !== null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!indexedDBAvailable()) {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("date", "date", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the media database."));
  });
}

function emitChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(progressPhotoChangedEvent));
  }
}

export async function loadProgressPhotos(): Promise<ProgressPhoto[]> {
  if (!indexedDBAvailable()) {
    return [];
  }
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return [];
  }
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => {
      const all = Array.isArray(request.result) ? request.result.filter(isProgressPhoto) : [];
      resolve(all);
    };
    request.onerror = () => resolve([]);
    tx.oncomplete = () => db.close();
  });
}

export async function saveProgressPhoto(photo: ProgressPhoto): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(photo);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not save the photo."));
    tx.onabort = () => reject(tx.error ?? new Error("Saving the photo was aborted."));
  });
  db.close();
  emitChanged();
}

export async function deleteProgressPhoto(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not delete the photo."));
  });
  db.close();
  emitChanged();
}
