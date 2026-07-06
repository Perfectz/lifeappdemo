"use client";

import { useEffect, useState } from "react";

import {
  syncNoticeEventName,
  type SyncNoticeDetail
} from "@/client/syncNotice";
import {
  storageErrorEventName,
  type StorageErrorDetail
} from "@/data/createLocalRepository";

/**
 * Listens for storage write failures (quota exceeded, private mode,
 * disabled storage) and shows a dismissable banner. Without this, a
 * failed save is completely silent — unacceptable for a life-tracking
 * app where the user assumes their data is safe.
 *
 * Also surfaces cloud-sync notices — e.g. when a sync merge had to discard
 * an older edit in favor of a newer one from another device — so conflict
 * resolution is never silent.
 */
export function StorageErrorToast() {
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"error" | "info">("error");

  useEffect(() => {
    function onError(event: Event) {
      const detail = (event as CustomEvent<StorageErrorDetail>).detail;
      setTone("error");
      setMessage(detail?.message ?? "Failed to save your data.");
    }
    function onNotice(event: Event) {
      const detail = (event as CustomEvent<SyncNoticeDetail>).detail;
      if (!detail?.message) return;
      setTone("info");
      setMessage(detail.message);
    }
    window.addEventListener(storageErrorEventName, onError);
    window.addEventListener(syncNoticeEventName, onNotice);
    return () => {
      window.removeEventListener(storageErrorEventName, onError);
      window.removeEventListener(syncNoticeEventName, onNotice);
    };
  }, []);

  if (!message) return null;

  return (
    <div
      className={
        tone === "error" ? "storage-error-toast" : "storage-error-toast storage-error-toast--info"
      }
      role={tone === "error" ? "alert" : "status"}
    >
      <span className="storage-error-toast-glyph" aria-hidden="true">
        {tone === "error" ? "!" : "i"}
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
