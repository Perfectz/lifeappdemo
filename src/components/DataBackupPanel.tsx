"use client";

import { useEffect, useRef, useState } from "react";

import {
  backupFileName,
  exportAllData,
  importAllData,
  serializeBackup
} from "@/client/dataBackup";
import { getLifeQuestStorageUsage } from "@/data/createLocalRepository";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

type StorageInfo = {
  usedBytes: number;
  quotaBytes?: number;
};

export function DataBackupPanel() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);

  async function refreshStorage() {
    const { totalBytes } = getLifeQuestStorageUsage(window.localStorage);
    let quotaBytes: number | undefined;
    try {
      if (navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate();
        quotaBytes = estimate.quota;
      }
    } catch {
      // estimate unavailable — show used-only.
    }
    setStorageInfo({ usedBytes: totalBytes, quotaBytes });
  }

  useEffect(() => {
    void refreshStorage();
  }, []);

  function handleExport() {
    try {
      const backup = exportAllData(window.localStorage);
      const blob = new Blob([serializeBackup(backup)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = backupFileName();
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      const keyCount = Object.keys(backup.data).length;
      setStatus({ tone: "ok", text: `Exported ${keyCount} data set${keyCount === 1 ? "" : "s"}.` });
    } catch {
      setStatus({ tone: "error", text: "Could not export your data." });
    }
  }

  async function handleImportFile(file: File) {
    const text = await file.text();
    const result = importAllData(window.localStorage, text);
    if (result.ok) {
      setStatus({
        tone: "ok",
        text: `Restored ${result.restoredKeys.length} data set${
          result.restoredKeys.length === 1 ? "" : "s"
        }. Reloading…`
      });
      void refreshStorage();
      // Reload so every screen re-reads the restored data.
      window.setTimeout(() => window.location.reload(), 700);
    } else {
      setStatus({ tone: "error", text: result.message });
    }
  }

  const usagePct =
    storageInfo?.quotaBytes && storageInfo.quotaBytes > 0
      ? Math.min(100, Math.round((storageInfo.usedBytes / storageInfo.quotaBytes) * 100))
      : null;

  return (
    <div className="data-backup-panel">
      <p className="data-backup-help">
        Your data lives only in this browser. Export a backup regularly — clearing
        site data or switching devices will otherwise lose your history.
      </p>

      <div className="data-backup-actions">
        <button type="button" className="command-button" onClick={handleExport}>
          <span>Download backup (JSON)</span>
        </button>
        <button
          type="button"
          className="command-button"
          onClick={() => fileInputRef.current?.click()}
        >
          <span>Restore from file…</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          aria-label="Choose a LifeQuest backup file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleImportFile(file);
            event.target.value = "";
          }}
        />
      </div>

      {status ? (
        <p
          className={
            status.tone === "error" ? "data-backup-status form-error" : "data-backup-status"
          }
          role={status.tone === "error" ? "alert" : "status"}
        >
          {status.text}
        </p>
      ) : null}

      {storageInfo ? (
        <div className="data-backup-usage">
          <div className="data-backup-usage-head">
            <span>Storage used</span>
            <strong>
              {formatBytes(storageInfo.usedBytes)}
              {storageInfo.quotaBytes ? ` / ${formatBytes(storageInfo.quotaBytes)}` : ""}
            </strong>
          </div>
          {usagePct !== null ? (
            <span className="stat-bar stat-bar-xp" aria-hidden="true">
              <span style={{ width: `${Math.max(2, usagePct)}%` }} />
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
