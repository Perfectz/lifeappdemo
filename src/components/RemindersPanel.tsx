"use client";

import { useEffect, useState } from "react";

import {
  areBrowserRemindersEnabled,
  setBrowserRemindersEnabled
} from "@/client/reminders";

type PermissionLabel = "unsupported" | "default" | "granted" | "denied";

function currentPermission(): PermissionLabel {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission as PermissionLabel;
}

export function RemindersPanel() {
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<PermissionLabel>("default");

  useEffect(() => {
    setEnabled(areBrowserRemindersEnabled(window.localStorage));
    setPermission(currentPermission());
  }, []);

  async function toggle(next: boolean) {
    if (next && typeof Notification !== "undefined" && Notification.permission === "default") {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionLabel);
      if (result !== "granted") {
        // Keep the preference off if permission wasn't granted.
        setBrowserRemindersEnabled(window.localStorage, false);
        setEnabled(false);
        return;
      }
    }
    setBrowserRemindersEnabled(window.localStorage, next);
    setEnabled(next);
  }

  const unsupported = permission === "unsupported";

  return (
    <div className="reminders-panel">
      <p className="reminders-help">
        In-app reminders always nudge you when a morning stand-up or evening
        postmortem is still open. Optionally, get a browser notification too.
      </p>
      <label className="reminders-toggle">
        <input
          type="checkbox"
          checked={enabled}
          disabled={unsupported || permission === "denied"}
          onChange={(event) => void toggle(event.target.checked)}
        />
        <span>Browser notifications</span>
      </label>
      <p className="reminders-status">
        {unsupported
          ? "This browser doesn't support notifications."
          : permission === "denied"
            ? "Notifications are blocked in your browser settings."
            : permission === "granted"
              ? "Permission granted."
              : "You'll be asked for permission when you enable this."}
      </p>
    </div>
  );
}
