import type { IsoDate, IsoDateTime } from "@/domain/types";

/**
 * Daily water tracking in fluid ounces. Stored as an append-only log of
 * pours so "undo last" is trivial and history stays auditable. Pure
 * functions — persistence lives in src/data/waterRepository.ts.
 */

export const DEFAULT_WATER_GOAL_OZ = 64;

export type WaterEntry = {
  id: string;
  date: IsoDate;
  /** Fluid ounces added by this pour (positive). */
  oz: number;
  recordedAt: IsoDateTime;
};

export function isWaterEntry(value: unknown): value is WaterEntry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const entry = value as Partial<WaterEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.date === "string" &&
    entry.date.trim().length > 0 &&
    typeof entry.oz === "number" &&
    Number.isFinite(entry.oz) &&
    entry.oz > 0 &&
    typeof entry.recordedAt === "string"
  );
}

export function createWaterEntry(
  date: IsoDate,
  oz: number,
  now: IsoDateTime = new Date().toISOString()
): WaterEntry {
  if (!date?.trim()) {
    throw new Error("Water entry date is required.");
  }
  if (!Number.isFinite(oz) || oz <= 0) {
    throw new Error("Water amount must be a positive number of ounces.");
  }
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `water-${now}-${Math.random().toString(36).slice(2)}`,
    date: date.trim(),
    oz,
    recordedAt: now
  };
}

/** Append a pour; returns a new log (input untouched). */
export function addWater(
  entries: WaterEntry[],
  date: IsoDate,
  oz: number,
  now: IsoDateTime = new Date().toISOString()
): WaterEntry[] {
  return [...entries, createWaterEntry(date, oz, now)];
}

/** Total fluid ounces logged on a date. */
export function getWaterForDate(entries: WaterEntry[], date: IsoDate): number {
  return entries
    .filter((entry) => entry.date === date)
    .reduce((total, entry) => total + entry.oz, 0);
}

/** Remove the most recent pour for a date; no-op when the day is empty. */
export function undoLastWater(entries: WaterEntry[], date: IsoDate): WaterEntry[] {
  let lastIndex = -1;
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (entry.date !== date) continue;
    if (lastIndex === -1 || entry.recordedAt >= entries[lastIndex].recordedAt) {
      lastIndex = i;
    }
  }
  if (lastIndex === -1) {
    return entries;
  }
  return entries.filter((_, index) => index !== lastIndex);
}

/** Progress toward the goal, clamped to 0–100. */
export function waterProgressPercent(
  oz: number,
  goalOz: number = DEFAULT_WATER_GOAL_OZ
): number {
  if (goalOz <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((oz / goalOz) * 100)));
}
