import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createLocalRepository,
  getLifeQuestStorageUsage,
  storageErrorEventName
} from "@/data/createLocalRepository";

type Widget = { id: string; n: number };

function isWidget(value: unknown): value is Widget {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Widget).id === "string" &&
    typeof (value as Widget).n === "number"
  );
}

function makeMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    key: (i) => Array.from(map.keys())[i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v)
  } as Storage;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createLocalRepository", () => {
  it("round-trips valid records and filters invalid ones", () => {
    const storage = makeMemoryStorage();
    const repo = createLocalRepository<Widget>(storage, "lifequest.widgets.v1", isWidget);

    repo.save([{ id: "a", n: 1 }]);
    expect(repo.load()).toEqual([{ id: "a", n: 1 }]);

    storage.setItem(
      "lifequest.widgets.v1",
      JSON.stringify([{ id: "a", n: 1 }, { bad: true }, { id: "b", n: 2 }])
    );
    expect(repo.load()).toEqual([{ id: "a", n: 1 }, { id: "b", n: 2 }]);
  });

  it("returns [] on corrupt JSON instead of throwing", () => {
    const storage = makeMemoryStorage();
    storage.setItem("lifequest.widgets.v1", "{not json");
    const repo = createLocalRepository<Widget>(storage, "lifequest.widgets.v1", isWidget);
    expect(repo.load()).toEqual([]);
  });

  it("emits a storage-error event instead of throwing when a write fails", () => {
    const storage = makeMemoryStorage();
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    const repo = createLocalRepository<Widget>(storage, "lifequest.widgets.v1", isWidget);

    const handler = vi.fn();
    window.addEventListener(storageErrorEventName, handler);
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => repo.save([{ id: "a", n: 1 }])).not.toThrow();
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(storageErrorEventName, handler);
  });

  it("migrates from a legacy key on first load and persists forward", () => {
    const storage = makeMemoryStorage();
    storage.setItem(
      "lifequest.widgets.v0",
      JSON.stringify([{ id: "legacy", value: 5 }])
    );

    const repo = createLocalRepository<Widget>(
      storage,
      "lifequest.widgets.v1",
      isWidget,
      [
        {
          fromKey: "lifequest.widgets.v0",
          migrate: (legacy) =>
            legacy.map((row) => {
              const r = row as { id: string; value: number };
              return { id: r.id, n: r.value };
            })
        }
      ]
    );

    expect(repo.load()).toEqual([{ id: "legacy", n: 5 }]);
    // Persisted forward so the migration only runs once.
    expect(JSON.parse(storage.getItem("lifequest.widgets.v1") as string)).toEqual([
      { id: "legacy", n: 5 }
    ]);
  });
});

describe("getLifeQuestStorageUsage", () => {
  it("sums only lifequest.* keys and sorts by size", () => {
    const storage = makeMemoryStorage();
    storage.setItem("lifequest.tasks.v1", "x".repeat(500));
    storage.setItem("lifequest.metricEntries.v1", "y".repeat(10));
    storage.setItem("unrelated.key", "z".repeat(9999));

    const usage = getLifeQuestStorageUsage(storage);
    // Only lifequest.* keys are counted, largest first.
    expect(usage.byKey.map((row) => row.key)).toEqual([
      "lifequest.tasks.v1",
      "lifequest.metricEntries.v1"
    ]);
    expect(usage.totalBytes).toBeGreaterThan(1000);
    expect(usage.byKey[0].bytes).toBeGreaterThan(usage.byKey[1].bytes);
  });
});
