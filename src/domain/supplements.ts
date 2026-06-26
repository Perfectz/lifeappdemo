import type { IsoDate, IsoDateTime, TimestampedEntity } from "@/domain/types";

/**
 * Supplement / medication intake log. The user checks off what they took in
 * each daily slot (morning, bedtime). The set of names they've used becomes the
 * quick-pick library — type a new one once, then pick it from the dropdown /
 * checklist next time. Stored as a collection and synced via the snapshot.
 */

export const supplementSlots = ["morning", "bedtime"] as const;
export type SupplementSlot = (typeof supplementSlots)[number];

export const supplementSlotLabel: Record<SupplementSlot, string> = {
  morning: "Morning",
  bedtime: "Bedtime"
};

export type SupplementLogEntry = TimestampedEntity & {
  date: IsoDate;
  slot: SupplementSlot;
  name: string;
  /** Free-form dose, e.g. "2 tablets" or "500 mg". */
  dose?: string;
  recordedAt: IsoDateTime;
};

export type SupplementLogInput = {
  date: IsoDate;
  slot: SupplementSlot;
  name: string;
  dose?: string;
};

export type SupplementLogValidationResult =
  | { ok: true; value: Required<Pick<SupplementLogInput, "date" | "slot" | "name">> & SupplementLogInput }
  | { ok: false; message: string };

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 80) : undefined;
}

export function validateSupplementLogInput(input: SupplementLogInput): SupplementLogValidationResult {
  const date = input.date?.trim();
  if (!date) {
    return { ok: false, message: "Date is required." };
  }
  if (!supplementSlots.includes(input.slot)) {
    return { ok: false, message: "Time of day is invalid." };
  }
  const name = input.name?.trim();
  if (!name) {
    return { ok: false, message: "Enter a supplement or medication name." };
  }
  return {
    ok: true,
    value: { date, slot: input.slot, name: name.slice(0, 80), dose: normalizeOptionalText(input.dose) }
  };
}

export function createSupplementLogEntry(
  input: SupplementLogInput,
  now: IsoDateTime = new Date().toISOString()
): SupplementLogEntry {
  const validation = validateSupplementLogInput(input);
  if (!validation.ok) {
    throw new Error(validation.message);
  }
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `supplement-${now}`,
    date: validation.value.date,
    slot: validation.value.slot,
    name: validation.value.name,
    dose: validation.value.dose,
    recordedAt: now,
    createdAt: now,
    updatedAt: now
  };
}

export function isSupplementLogEntry(value: unknown): value is SupplementLogEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<SupplementLogEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.date === "string" &&
    entry.slot !== undefined &&
    supplementSlots.includes(entry.slot) &&
    typeof entry.name === "string" &&
    entry.name.trim().length > 0 &&
    (entry.dose === undefined || typeof entry.dose === "string") &&
    typeof entry.recordedAt === "string" &&
    typeof entry.createdAt === "string" &&
    typeof entry.updatedAt === "string"
  );
}

function normName(name: string): string {
  return name.trim().toLowerCase();
}

export function getSupplementsForDate(entries: SupplementLogEntry[], date: IsoDate): SupplementLogEntry[] {
  return entries.filter((entry) => entry.date === date);
}

/** Was a given supplement logged for this date + slot (case-insensitive)? */
export function isSupplementTaken(
  entries: SupplementLogEntry[],
  date: IsoDate,
  slot: SupplementSlot,
  name: string
): boolean {
  const target = normName(name);
  return entries.some(
    (entry) => entry.date === date && entry.slot === slot && normName(entry.name) === target
  );
}

/** Distinct supplements ever logged — the quick-pick library, newest first, with the last dose used. */
export function getKnownSupplements(entries: SupplementLogEntry[]): { name: string; lastDose?: string }[] {
  const sorted = [...entries].sort((a, b) => (b.recordedAt > a.recordedAt ? 1 : -1));
  const seen = new Map<string, { name: string; lastDose?: string }>();
  for (const entry of sorted) {
    const key = normName(entry.name);
    if (!seen.has(key)) {
      seen.set(key, { name: entry.name, lastDose: entry.dose });
    }
  }
  return [...seen.values()];
}
