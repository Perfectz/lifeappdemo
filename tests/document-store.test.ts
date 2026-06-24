import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDocumentStore } from "@/data/createDocumentStore";
import { dataChangedEventName } from "@/data/createLocalRepository";

type Settings = { theme: string; volume: number };

function isSettings(value: unknown): value is Settings {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as Settings).theme === "string" &&
    typeof (value as Settings).volume === "number"
  );
}

const fallback = (): Settings => ({ theme: "dark", volume: 5 });
const store = createDocumentStore<Settings>("lifequest.test.settings.v1", isSettings, fallback);

describe("createDocumentStore", () => {
  beforeEach(() => window.localStorage.clear());

  it("returns the fallback when nothing is stored", () => {
    expect(store.load(window.localStorage)).toEqual({ theme: "dark", volume: 5 });
  });

  it("round-trips a valid document and dispatches a data-changed event", () => {
    const listener = vi.fn();
    window.addEventListener(dataChangedEventName, listener);
    store.save(window.localStorage, { theme: "light", volume: 8 });
    expect(store.load(window.localStorage)).toEqual({ theme: "light", volume: 8 });
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(dataChangedEventName, listener);
  });

  it("falls back when the stored value is the wrong shape", () => {
    window.localStorage.setItem(store.storageKey, JSON.stringify({ theme: 1 }));
    expect(store.load(window.localStorage)).toEqual({ theme: "dark", volume: 5 });
  });

  it("falls back on corrupt JSON instead of throwing", () => {
    window.localStorage.setItem(store.storageKey, "{not json");
    expect(() => store.load(window.localStorage)).not.toThrow();
    expect(store.load(window.localStorage)).toEqual({ theme: "dark", volume: 5 });
  });
});
