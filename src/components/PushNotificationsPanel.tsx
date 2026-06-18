"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getPushStatus,
  subscribeToPush,
  unsubscribeFromPush,
  type PushStatus
} from "@/client/pushClient";

export function PushNotificationsPanel() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    setStatus(await getPushStatus());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function enable() {
    setBusy(true);
    setMessage(null);
    const result = await subscribeToPush();
    setBusy(false);
    setMessage(
      result.ok
        ? { tone: "ok", text: "Reminders enabled on this device." }
        : { tone: "error", text: result.message }
    );
    await refresh();
  }

  async function disable() {
    setBusy(true);
    setMessage(null);
    await unsubscribeFromPush();
    setBusy(false);
    setMessage({ tone: "ok", text: "Reminders disabled on this device." });
    await refresh();
  }

  if (status && !status.supported) {
    return <p className="reminders-help">This device/browser doesn&apos;t support push notifications.</p>;
  }

  return (
    <div className="data-backup-panel">
      <p className="data-backup-help">
        Get a phone reminder if you haven&apos;t logged your vitals by 7:30am, or a workout by its
        window (9am / 6pm / 9pm). Works even when the app is closed.
      </p>
      <div className="data-backup-actions">
        {status?.subscribed ? (
          <button type="button" className="command-button" onClick={disable} disabled={busy}>
            <span>Turn off reminders</span>
          </button>
        ) : (
          <button type="button" className="command-button" onClick={enable} disabled={busy}>
            <span>{busy ? "Enabling…" : "Enable reminders"}</span>
          </button>
        )}
      </div>
      {message ? (
        <p
          className={message.tone === "error" ? "data-backup-status form-error" : "data-backup-status"}
          role={message.tone === "error" ? "alert" : "status"}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
