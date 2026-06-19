/** Tiny on-device toggle for game SFX. Default on (the user opted into the RPG feel). */

const KEY = "lifequest.sound.v1";
export const soundChangedEventName = "lifequest:sound-changed";

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return true; // default on
    return JSON.parse(raw)?.enabled !== false;
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ enabled }));
    window.dispatchEvent(new Event(soundChangedEventName));
  } catch {
    // non-fatal
  }
}
