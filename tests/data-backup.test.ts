import { describe, expect, it } from "vitest";

import {
  backupAppId,
  backupFileName,
  backupSchemaVersion,
  exportAllData,
  importAllData,
  serializeBackup
} from "@/client/dataBackup";

function makeMemoryStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map<string, string>(Object.entries(seed));
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

describe("data backup", () => {
  it("exports an envelope of all lifequest keys", () => {
    const storage = makeMemoryStorage({
      "lifequest.tasks.v1": JSON.stringify([{ id: "t1" }]),
      "lifequest.profile.v1": JSON.stringify({ heroName: "Aria" }),
      "unrelated.key": "ignore me"
    });

    const backup = exportAllData(storage);
    expect(backup.app).toBe(backupAppId);
    expect(backup.schemaVersion).toBe(backupSchemaVersion);
    expect(Object.keys(backup.data).sort()).toEqual([
      "lifequest.profile.v1",
      "lifequest.tasks.v1"
    ]);
    expect(backup.data["lifequest.tasks.v1"]).toEqual([{ id: "t1" }]);
  });

  it("round-trips export → import into a fresh store", () => {
    const source = makeMemoryStorage({
      "lifequest.tasks.v1": JSON.stringify([{ id: "t1", title: "Quest" }]),
      "lifequest.metricEntries.v1": JSON.stringify([{ id: "m1" }])
    });
    const json = serializeBackup(exportAllData(source));

    const target = makeMemoryStorage();
    const result = importAllData(target, json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.restoredKeys.sort()).toEqual([
        "lifequest.metricEntries.v1",
        "lifequest.tasks.v1"
      ]);
    }
    expect(JSON.parse(target.getItem("lifequest.tasks.v1") as string)).toEqual([
      { id: "t1", title: "Quest" }
    ]);
  });

  it("rejects non-JSON and non-LifeQuest files", () => {
    const storage = makeMemoryStorage();
    expect(importAllData(storage, "not json").ok).toBe(false);
    expect(importAllData(storage, JSON.stringify({ app: "other" })).ok).toBe(false);
  });

  it("never writes outside the lifequest namespace", () => {
    const storage = makeMemoryStorage();
    const malicious = JSON.stringify({
      app: backupAppId,
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      data: {
        "lifequest.tasks.v1": [{ id: "ok" }],
        "evil.key": "should be ignored"
      }
    });
    const result = importAllData(storage, malicious);
    expect(result.ok).toBe(true);
    expect(storage.getItem("evil.key")).toBeNull();
    expect(storage.getItem("lifequest.tasks.v1")).not.toBeNull();
  });

  it("builds a timestamped file name", () => {
    expect(backupFileName(new Date("2026-05-26T08:09:10.000Z"))).toBe(
      "lifequest-backup-2026-05-26-08-09-10.json"
    );
  });
});
