import { afterEach, describe, expect, it, vi } from "vitest";

import { fxChangedEventName, isFxEnabled, setFxEnabled } from "@/client/fxSettings";

const KEY = "lifequest.fx.v1";

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("fxSettings", () => {
  it("defaults to enabled when nothing is stored", () => {
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(isFxEnabled()).toBe(true);
  });

  it("round-trips set/get through localStorage", () => {
    setFxEnabled(false);
    expect(isFxEnabled()).toBe(false);
    expect(window.localStorage.getItem(KEY)).toBe(JSON.stringify({ enabled: false }));

    setFxEnabled(true);
    expect(isFxEnabled()).toBe(true);
  });

  it("fires the fx-changed event on change", () => {
    const listener = vi.fn();
    window.addEventListener(fxChangedEventName, listener);
    try {
      setFxEnabled(false);
      expect(listener).toHaveBeenCalledTimes(1);
      setFxEnabled(true);
      expect(listener).toHaveBeenCalledTimes(2);
    } finally {
      window.removeEventListener(fxChangedEventName, listener);
    }
  });

  it("treats corrupt stored JSON as enabled", () => {
    window.localStorage.setItem(KEY, "{not json");
    expect(isFxEnabled()).toBe(true);
  });

  it("does not throw when storage writes fail", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => setFxEnabled(false)).not.toThrow();
  });
});
