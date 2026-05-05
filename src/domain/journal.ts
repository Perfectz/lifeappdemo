import type {
  EntityId,
  IsoDate,
  IsoDateTime,
  JournalEntry,
  JournalEntryType,
  JournalSource
} from "@/domain/types";

export const journalEntryTypes: JournalEntryType[] = [
  "morning_intention",
  "evening_reflection",
  "lesson",
  "freeform"
];

export const journalSources: JournalSource[] = [
  "manual",
  "ai_assisted",
  "voice_transcript",
  "demo"
];

export const journalPrompts = [
  "What did I learn today?",
  "What felt harder than expected?",
  "What pattern do I want to notice?",
  "What would make tomorrow easier?",
  "What might be worth sharing publicly?"
];

const maxContentLength = 10_000;

export type JournalEntryInput = {
  date: IsoDate;
  type: JournalEntryType;
  prompt?: string;
  content: string;
  linkedDailyPlanId?: EntityId;
  linkedPostmortemId?: EntityId;
};

export type JournalValidationResult =
  | { ok: true; value: JournalEntryInput }
  | { ok: false; message: string };

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function validateJournalEntryInput(input: JournalEntryInput): JournalValidationResult {
  const date = input.date.trim();
  const content = input.content.trim();

  if (!date) {
    return { ok: false, message: "Journal date is required." };
  }

  if (!journalEntryTypes.includes(input.type)) {
    return { ok: false, message: "Journal entry type is invalid." };
  }

  if (!content) {
    return { ok: false, message: "Journal content is required." };
  }

  if (content.length > maxContentLength) {
    return { ok: false, message: "Journal content must be 10,000 characters or fewer." };
  }

  return {
    ok: true,
    value: {
      date,
      type: input.type,
      prompt: normalizeOptionalText(input.prompt),
      content,
      linkedDailyPlanId: normalizeOptionalText(input.linkedDailyPlanId),
      linkedPostmortemId: normalizeOptionalText(input.linkedPostmortemId)
    }
  };
}

export function createJournalEntry(
  input: JournalEntryInput,
  now: IsoDateTime = new Date().toISOString()
): JournalEntry {
  const validation = validateJournalEntryInput(input);

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  return {
    id: globalThis.crypto?.randomUUID?.() ?? `journal-${now}`,
    date: validation.value.date,
    type: validation.value.type,
    prompt: validation.value.prompt,
    content: validation.value.content,
    linkedDailyPlanId: validation.value.linkedDailyPlanId,
    linkedPostmortemId: validation.value.linkedPostmortemId,
    source: "manual",
    createdAt: now,
    updatedAt: now
  };
}

export function updateJournalEntry(
  entry: JournalEntry,
  input: JournalEntryInput,
  now: IsoDateTime = new Date().toISOString()
): JournalEntry {
  const validation = validateJournalEntryInput(input);

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  return {
    ...entry,
    date: validation.value.date,
    type: validation.value.type,
    prompt: validation.value.prompt,
    content: validation.value.content,
    linkedDailyPlanId: validation.value.linkedDailyPlanId,
    linkedPostmortemId: validation.value.linkedPostmortemId,
    updatedAt: now
  };
}

export function deleteJournalEntry(entries: JournalEntry[], entryId: EntityId): JournalEntry[] {
  return entries.filter((entry) => entry.id !== entryId);
}

export function getJournalEntriesForDate(
  entries: JournalEntry[],
  date: IsoDate
): JournalEntry[] {
  return entries.filter((entry) => entry.date === date);
}

export function getRecentJournalEntries(entries: JournalEntry[], limit = 8): JournalEntry[] {
  return [...entries]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, limit);
}

export function isJournalEntry(value: unknown): value is JournalEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<JournalEntry>;

  return (
    typeof entry.id === "string" &&
    typeof entry.date === "string" &&
    entry.type !== undefined &&
    journalEntryTypes.includes(entry.type) &&
    (entry.prompt === undefined || typeof entry.prompt === "string") &&
    typeof entry.content === "string" &&
    entry.content.trim().length > 0 &&
    entry.content.length <= maxContentLength &&
    (entry.linkedDailyPlanId === undefined || typeof entry.linkedDailyPlanId === "string") &&
    (entry.linkedPostmortemId === undefined || typeof entry.linkedPostmortemId === "string") &&
    entry.source !== undefined &&
    journalSources.includes(entry.source) &&
    typeof entry.createdAt === "string" &&
    typeof entry.updatedAt === "string"
  );
}
