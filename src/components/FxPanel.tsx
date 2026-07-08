"use client";

import { useEffect, useState } from "react";

import { fxChangedEventName, isFxEnabled, setFxEnabled } from "@/client/fxSettings";

export function FxPanel() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const sync = () => setEnabled(isFxEnabled());
    sync();
    window.addEventListener(fxChangedEventName, sync);
    return () => window.removeEventListener(fxChangedEventName, sync);
  }, []);

  function toggle() {
    const next = !enabled;
    setFxEnabled(next);
    setEnabled(next);
  }

  return (
    <div className="sound-panel">
      <p className="reminders-help">
        Ambient effects: a soft animated backdrop of mana motes and a retro
        horizon grid behind the menus, with a spark burst when you level up.
      </p>
      <button
        type="button"
        className="login-submit"
        onClick={toggle}
        aria-pressed={enabled}
      >
        <span>{enabled ? "Effects: ON ✨" : "Effects: OFF"}</span>
      </button>
    </div>
  );
}
