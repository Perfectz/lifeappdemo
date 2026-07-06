import { describe, expect, it } from "vitest";

import {
  canonicalStringify,
  describeMergeLoss,
  mergeSnapshotData
} from "@/data/snapshotMerge";

const KEY = "lifequest.tasks.v1";

function task(id: string, title: string, updatedAt: string) {
  return { id, title, updatedAt };
}

describe("canonicalStringify", () => {
  it("is insensitive to object key order (jsonb round-trips reorder keys)", () => {
    const a = { id: "1", nested: { x: 1, y: 2 }, title: "T" };
    const b = { title: "T", nested: { y: 2, x: 1 }, id: "1" };
    expect(canonicalStringify(a)).toBe(canonicalStringify(b));
  });
});

describe("mergeSnapshotData collections", () => {
  it("unions records by id from both sides", () => {
    const local = { [KEY]: [task("a", "local A", "2026-01-01T00:00:00.000Z")] };
    const cloud = { [KEY]: [task("b", "cloud B", "2026-01-02T00:00:00.000Z")] };

    const result = mergeSnapshotData(local, cloud);
    const merged = result.data[KEY] as { id: string }[];
    expect(merged.map((r) => r.id).sort()).toEqual(["a", "b"]);
    expect(result.stats.localDiscarded).toBe(0);
    expect(result.stats.cloudDiscarded).toBe(0);
    expect(result.changedFromCloud).toBe(true); // cloud is missing "a"
    expect(result.changedFromLocal).toBe(true); // local is missing "b"
  });

  it("newest updatedAt wins for the same record id (cloud newer)", () => {
    const local = { [KEY]: [task("a", "stale local", "2026-01-01T00:00:00.000Z")] };
    const cloud = { [KEY]: [task("a", "fresh cloud", "2026-01-05T00:00:00.000Z")] };

    const result = mergeSnapshotData(local, cloud);
    const merged = result.data[KEY] as { title: string }[];
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe("fresh cloud");
    expect(result.stats.localDiscarded).toBe(1);
    expect(result.stats.cloudDiscarded).toBe(0);
    expect(result.stats.conflictKeys).toEqual([KEY]);
  });

  it("newest updatedAt wins for the same record id (local newer)", () => {
    const local = { [KEY]: [task("a", "fresh local", "2026-01-05T00:00:00.000Z")] };
    const cloud = { [KEY]: [task("a", "stale cloud", "2026-01-01T00:00:00.000Z")] };

    const result = mergeSnapshotData(local, cloud);
    const merged = result.data[KEY] as { title: string }[];
    expect(merged[0].title).toBe("fresh local");
    expect(result.stats.cloudDiscarded).toBe(1);
    expect(result.changedFromCloud).toBe(true);
    expect(result.changedFromLocal).toBe(false);
  });

  it("falls back to recordedAt when updatedAt is absent", () => {
    const local = { [KEY]: [{ id: "m", value: 1, recordedAt: "2026-02-01T00:00:00.000Z" }] };
    const cloud = { [KEY]: [{ id: "m", value: 2, recordedAt: "2026-02-03T00:00:00.000Z" }] };

    const result = mergeSnapshotData(local, cloud);
    expect((result.data[KEY] as { value: number }[])[0].value).toBe(2);
    expect(result.stats.localDiscarded).toBe(1);
  });

  it("keeps local and counts a cloud discard when neither side has timestamps", () => {
    const local = { [KEY]: [{ id: "x", value: "local" }] };
    const cloud = { [KEY]: [{ id: "x", value: "cloud" }] };

    const result = mergeSnapshotData(local, cloud);
    expect((result.data[KEY] as { value: string }[])[0].value).toBe("local");
    expect(result.stats.cloudDiscarded).toBe(1);
  });

  it("keeps both sides' concurrent edits to DIFFERENT records (no data loss)", () => {
    // Device A edited task "a", device B edited task "b", from the same base.
    const base = {
      a: task("a", "base A", "2026-01-01T00:00:00.000Z"),
      b: task("b", "base B", "2026-01-01T00:00:00.000Z")
    };
    const local = { [KEY]: [task("a", "edited on A", "2026-01-03T00:00:00.000Z"), base.b] };
    const cloud = { [KEY]: [base.a, task("b", "edited on B", "2026-01-04T00:00:00.000Z")] };

    const result = mergeSnapshotData(local, cloud);
    const merged = result.data[KEY] as { id: string; title: string }[];
    expect(merged.find((r) => r.id === "a")?.title).toBe("edited on A");
    expect(merged.find((r) => r.id === "b")?.title).toBe("edited on B");
    // Each side's stale base copy was superseded — both counted, both directions.
    expect(result.stats.localDiscarded).toBe(1);
    expect(result.stats.cloudDiscarded).toBe(1);
    expect(result.changedFromCloud).toBe(true);
    expect(result.changedFromLocal).toBe(true);
  });

  it("keeps both sides' concurrent edits to DIFFERENT keys (no data loss)", () => {
    const tasksKey = "lifequest.tasks.v1";
    const notesKey = "lifequest.notes.v1";
    const local = {
      [tasksKey]: [task("t1", "edited locally", "2026-01-05T00:00:00.000Z")],
      [notesKey]: [{ id: "n1", body: "base note", updatedAt: "2026-01-01T00:00:00.000Z" }]
    };
    const cloud = {
      [tasksKey]: [task("t1", "base task", "2026-01-01T00:00:00.000Z")],
      [notesKey]: [{ id: "n1", body: "edited remotely", updatedAt: "2026-01-06T00:00:00.000Z" }]
    };

    const result = mergeSnapshotData(local, cloud);
    expect((result.data[tasksKey] as { title: string }[])[0].title).toBe("edited locally");
    expect((result.data[notesKey] as { body: string }[])[0].body).toBe("edited remotely");
    expect(result.stats.conflictKeys.sort()).toEqual([notesKey, tasksKey]);
  });

  it("does not count identical records (even with reordered keys) as conflicts", () => {
    const local = { [KEY]: [{ id: "a", title: "same", updatedAt: "2026-01-01T00:00:00.000Z" }] };
    const cloud = { [KEY]: [{ updatedAt: "2026-01-01T00:00:00.000Z", title: "same", id: "a" }] };

    const result = mergeSnapshotData(local, cloud);
    expect(result.stats.localDiscarded).toBe(0);
    expect(result.stats.cloudDiscarded).toBe(0);
    expect(result.stats.conflictKeys).toEqual([]);
    expect(result.changedFromCloud).toBe(false);
    expect(result.changedFromLocal).toBe(false);
  });
});

describe("mergeSnapshotData documents and keys", () => {
  it("keeps keys present on only one side (union)", () => {
    const local = { "lifequest.profile.v1": { heroName: "Aria" } };
    const cloud = { "lifequest.notes.v1": [{ id: "n1", updatedAt: "2026-01-01T00:00:00.000Z" }] };

    const result = mergeSnapshotData(local, cloud);
    expect(Object.keys(result.data).sort()).toEqual([
      "lifequest.notes.v1",
      "lifequest.profile.v1"
    ]);
    expect(result.stats.localDiscarded).toBe(0);
    expect(result.stats.cloudDiscarded).toBe(0);
  });

  it("picks the newer document by updatedAt", () => {
    const key = "lifequest.healthGoals.v1";
    const local = { [key]: { targetWeightKg: 80, updatedAt: "2026-03-01T00:00:00.000Z" } };
    const cloud = { [key]: { targetWeightKg: 78, updatedAt: "2026-03-10T00:00:00.000Z" } };

    const result = mergeSnapshotData(local, cloud);
    expect((result.data[key] as { targetWeightKg: number }).targetWeightKg).toBe(78);
    expect(result.stats.localDiscarded).toBe(1);
    expect(result.stats.conflictKeys).toEqual([key]);
  });

  it("keeps the local document on a timestamp tie", () => {
    const key = "lifequest.bodyProfile.v1";
    const stamp = "2026-03-01T00:00:00.000Z";
    const local = { [key]: { heightCm: 180, updatedAt: stamp } };
    const cloud = { [key]: { heightCm: 181, updatedAt: stamp } };

    const result = mergeSnapshotData(local, cloud);
    expect((result.data[key] as { heightCm: number }).heightCm).toBe(180);
    expect(result.stats.cloudDiscarded).toBe(1);
  });
});

describe("describeMergeLoss", () => {
  it("returns null when nothing was discarded", () => {
    expect(describeMergeLoss({ localDiscarded: 0, cloudDiscarded: 0, conflictKeys: [] })).toBeNull();
  });

  it("mentions both sides' losses", () => {
    const message = describeMergeLoss({ localDiscarded: 2, cloudDiscarded: 1, conflictKeys: ["k"] });
    expect(message).toContain("2 older items on this device");
    expect(message).toContain("1 older cloud item");
  });
});
