"use client";

import { useEffect, useState } from "react";

import { playDing } from "@/client/sfx";
import { isSoundEnabled, setSoundEnabled, soundChangedEventName } from "@/client/soundSettings";

export function SoundPanel() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    const sync = () => setEnabled(isSoundEnabled());
    sync();
    window.addEventListener(soundChangedEventName, sync);
    return () => window.removeEventListener(soundChangedEventName, sync);
  }, []);

  function toggle() {
    const next = !enabled;
    setSoundEnabled(next);
    setEnabled(next);
    if (next) playDing();
  }

  return (
    <div className="sound-panel">
      <p className="reminders-help">
        8-bit sound effects: a blip when you log, and a fanfare when you level up.
      </p>
      <button
        type="button"
        className="login-submit"
        onClick={toggle}
        aria-pressed={enabled}
      >
        <span>{enabled ? "Sound: ON 🔊" : "Sound: OFF 🔇"}</span>
      </button>
    </div>
  );
}
