/** Tiny on-device toggle for the ambient visual effects layer. Default on. */

const KEY = "lifequest.fx.v1";
export const fxChangedEventName = "lifequest:fx-changed";

export function isFxEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return true; // default on
    return JSON.parse(raw)?.enabled !== false;
  } catch {
    return true;
  }
}

export function setFxEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ enabled }));
    window.dispatchEvent(new Event(fxChangedEventName));
  } catch {
    // non-fatal
  }
}
