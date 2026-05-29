"use client";

import { useEffect, useState } from "react";

import {
  storageErrorEventName,
  type StorageErrorDetail
} from "@/data/createLocalRepository";

/**
 * Listens for storage write failures (quota exceeded, private mode,
 * disabled storage) and shows a dismissable banner. Without this, a
 * failed save is completely silent — unacceptable for a life-tracking
 * app where the user assumes their data is safe.
 */
export function StorageErrorToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    function onError(event: Event) {
      const detail = (event as CustomEvent<StorageErrorDetail>).detail;
      setMessage(detail?.message ?? "Failed to save your data.");
    }
    window.addEventListener(storageErrorEventName, onError);
    return () => window.removeEventListener(storageErrorEventName, onError);
  }, []);

  if (!message) return null;

  return (
    <div className="storage-error-toast" role="alert">
      <span className="storage-error-toast-glyph" aria-hidden="true">
        !
      </span>
      <p>{message}</p>
      <button
        type="button"
        onClick={() => setMessage(null)}
        aria-label="Dismiss"
        className="storage-error-toast-close"
      >
        ✕
      </button>
    </div>
  );
}
