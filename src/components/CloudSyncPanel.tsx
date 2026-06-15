"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getCurrentCloudUser,
  getLastSyncedAt,
  isCloudSyncConfigured,
  pullSnapshot,
  pushSnapshot,
  sendMagicLink,
  signOutCloud,
  type CloudUser
} from "@/client/cloudSync";

type Status = { tone: "ok" | "error"; text: string } | null;

function formatSyncedAt(iso: string | null): string {
  if (!iso) return "never";
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "never";
  return new Date(parsed).toLocaleString();
}

export function CloudSyncPanel() {
  const configured = isCloudSyncConfigured();
  const [user, setUser] = useState<CloudUser | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!configured) return;
    setUser(await getCurrentCloudUser());
    setLastSynced(getLastSyncedAt());
  }, [configured]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!configured) {
    return (
      <p className="reminders-help">
        Cloud backup isn&apos;t configured. Your data is saved locally on this device. To
        sync across devices, add a Supabase project URL and anon key, then redeploy.
      </p>
    );
  }

  async function handleSendLink() {
    setBusy(true);
    setStatus(null);
    const result = await sendMagicLink(email);
    setBusy(false);
    setStatus(
      result.ok
        ? { tone: "ok", text: "Check your email for a sign-in link, then return here." }
        : { tone: "error", text: result.message }
    );
  }

  async function handleBackup() {
    setBusy(true);
    setStatus(null);
    const result = await pushSnapshot();
    setBusy(false);
    if (result.ok) {
      setLastSynced(result.at);
      setStatus({ tone: "ok", text: "Backed up to the cloud." });
    } else {
      setStatus({ tone: "error", text: result.message });
    }
  }

  async function handleRestore() {
    if (!window.confirm("Replace this device's data with the cloud backup? A local copy is saved first.")) {
      return;
    }
    setBusy(true);
    setStatus(null);
    const result = await pullSnapshot();
    setBusy(false);
    if (result.ok) {
      setLastSynced(result.at);
      setStatus({ tone: "ok", text: "Restored from the cloud. Reloading…" });
      window.setTimeout(() => window.location.reload(), 700);
    } else {
      setStatus({ tone: "error", text: result.message });
    }
  }

  async function handleSignOut() {
    setBusy(true);
    await signOutCloud();
    setBusy(false);
    setUser(null);
    setStatus({ tone: "ok", text: "Signed out. Local data is untouched." });
  }

  return (
    <div className="data-backup-panel">
      <p className="data-backup-help">
        Sign in to back up your local data to the cloud and sync it across devices.
        Sign-in is optional — the app works fully without it.
      </p>

      {user ? (
        <>
          <p className="reminders-help">
            Signed in as <strong>{user.email ?? "your account"}</strong>. Last synced:{" "}
            <strong>{formatSyncedAt(lastSynced)}</strong>.
          </p>
          <div className="data-backup-actions">
            <button type="button" className="command-button" onClick={handleBackup} disabled={busy}>
              <span>Back up now</span>
            </button>
            <button type="button" className="command-button" onClick={handleRestore} disabled={busy}>
              <span>Restore from cloud…</span>
            </button>
            <button type="button" className="command-button" onClick={handleSignOut} disabled={busy}>
              <span>Sign out</span>
            </button>
          </div>
        </>
      ) : (
        <div className="data-backup-actions">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            className="cloud-sync-email"
            placeholder="you@example.com"
            aria-label="Email for sign-in link"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button type="button" className="command-button" onClick={handleSendLink} disabled={busy}>
            <span>{busy ? "Sending…" : "Send sign-in link"}</span>
          </button>
        </div>
      )}

      {status ? (
        <p
          className={status.tone === "error" ? "data-backup-status form-error" : "data-backup-status"}
          role={status.tone === "error" ? "alert" : "status"}
        >
          {status.text}
        </p>
      ) : null}
    </div>
  );
}
