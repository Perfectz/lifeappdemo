import { describe, expect, it } from "vitest";

import { createLocalWaterRepository, waterStorageKey } from "@/data/waterRepository";
import {
  addWater,
  createWaterEntry,
  DEFAULT_WATER_GOAL_OZ,
  getWaterForDate,
  isWaterEntry,
  undoLastWater,
  waterProgressPercent
} from "@/domain/waterTracking";

const DAY = "2026-07-08";

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

describe("water tracking domain", () => {
  it("exports a 64 oz default goal", () => {
    expect(DEFAULT_WATER_GOAL_OZ).toBe(64);
  });

  it("accumulates pours per date", () => {
    let log = addWater([], DAY, 8, "2026-07-08T08:00:00.000Z");
    log = addWater(log, DAY, 16, "2026-07-08T10:00:00.000Z");
    log = addWater(log, "2026-07-07", 8, "2026-07-07T09:00:00.000Z");

    expect(getWaterForDate(log, DAY)).toBe(24);
    expect(getWaterForDate(log, "2026-07-07")).toBe(8);
    expect(getWaterForDate(log, "2026-07-06")).toBe(0);
  });

  it("does not mutate the input log", () => {
    const original = addWater([], DAY, 8);
    const next = addWater(original, DAY, 8);
    expect(original).toHaveLength(1);
    expect(next).toHaveLength(2);
  });

  it("undoes only the most recent pour for the given date", () => {
    let log = addWater([], DAY, 8, "2026-07-08T08:00:00.000Z");
    log = addWater(log, "2026-07-07", 16, "2026-07-07T09:00:00.000Z");
    log = addWater(log, DAY, 16, "2026-07-08T12:00:00.000Z");

    const undone = undoLastWater(log, DAY);

    expect(getWaterForDate(undone, DAY)).toBe(8); // the 16 oz pour was removed
    expect(getWaterForDate(undone, "2026-07-07")).toBe(16); // other days untouched
    expect(undoLastWater([], DAY)).toEqual([]); // empty day is a no-op
  });

  it("rejects non-positive or invalid amounts", () => {
    expect(() => createWaterEntry(DAY, 0)).toThrow();
    expect(() => createWaterEntry(DAY, -8)).toThrow();
    expect(() => createWaterEntry(DAY, Number.NaN)).toThrow();
    expect(() => createWaterEntry("", 8)).toThrow();
  });

  it("guards persisted shapes", () => {
    expect(isWaterEntry(createWaterEntry(DAY, 8))).toBe(true);
    expect(isWaterEntry({ id: "x", date: DAY, oz: 0, recordedAt: "t" })).toBe(false);
    expect(isWaterEntry({ id: "x", date: DAY })).toBe(false);
    expect(isWaterEntry(null)).toBe(false);
  });

  it("clamps progress percent to 0-100", () => {
    expect(waterProgressPercent(0)).toBe(0);
    expect(waterProgressPercent(32)).toBe(50);
    expect(waterProgressPercent(96)).toBe(100);
    expect(waterProgressPercent(10, 0)).toBe(0);
  });
});

describe("water repository", () => {
  it("round-trips the log under lifequest.water.v1 and filters junk", () => {
    const storage = makeMemoryStorage();
    const repo = createLocalWaterRepository(storage);

    repo.save(addWater([], DAY, 8, "2026-07-08T08:00:00.000Z"));
    expect(repo.load()).toHaveLength(1);
    expect(getWaterForDate(repo.load(), DAY)).toBe(8);
    expect(waterStorageKey).toBe("lifequest.water.v1");

    const stored = JSON.parse(storage.getItem(waterStorageKey) ?? "[]") as unknown[];
    storage.setItem(waterStorageKey, JSON.stringify([...stored, { bogus: true }]));
    expect(repo.load()).toHaveLength(1);
  });
});
