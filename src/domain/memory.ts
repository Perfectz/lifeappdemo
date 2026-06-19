import type { IsoDateTime } from "@/domain/types";

/**
 * Agent-writable long-term memory (Karpathy "LLM memory / wiki" style): a
 * growing set of keyed facts the AI agent — or the user — can store and recall
 * across sessions. Distinct from the hand-authored About Me wiki: this is the
 * flexible, append-as-you-go notebook ("resume", "favorite workouts", "coffee
 * order", ...). Stored locally and synced via the cloud snapshot.
 */

export const memorySources = ["user", "agent"] as const;
export type MemorySource = (typeof memorySources)[number];

export type MemoryEntry = {
  id: string;
  /** Short topic/title used as the upsert identity, e.g. "resume". */
  key: string;
  content: string;
  source: MemorySource;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type MemoryInput = {
  key: string;
  content: string;
  source?: MemorySource;
};

export type MemoryValidationResult =
  | { ok: true; value: { key: string; content: string; source: MemorySource } }
  | { ok: false; message: string };

const MAX_KEY = 80;
const MAX_CONTENT = 4000;

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

export function validateMemoryInput(input: MemoryInput): MemoryValidationResult {
  const key = input.key?.trim();
  if (!key) {
    return { ok: false, message: "Memory needs a short key/topic." };
  }
  const content = input.content?.trim();
  if (!content) {
    return { ok: false, message: "Memory needs content to store." };
  }
  const source = input.source && memorySources.includes(input.source) ? input.source : "agent";
  return {
    ok: true,
    value: { key: key.slice(0, MAX_KEY), content: content.slice(0, MAX_CONTENT), source }
  };
}

export function createMemoryEntry(
  input: MemoryInput,
  now: IsoDateTime = new Date().toISOString()
): MemoryEntry {
  const validation = validateMemoryInput(input);
  if (!validation.ok) {
    throw new Error(validation.message);
  }
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `memory-${now}`,
    key: validation.value.key,
    content: validation.value.content,
    source: validation.value.source,
    createdAt: now,
    updatedAt: now
  };
}

/** Insert or replace a memory by key (case-insensitive). Newest-updated first. */
export function upsertMemory(
  entries: MemoryEntry[],
  input: MemoryInput,
  now: IsoDateTime = new Date().toISOString()
): MemoryEntry[] {
  const validation = validateMemoryInput(input);
  if (!validation.ok) {
    throw new Error(validation.message);
  }
  const targetKey = normalizeKey(validation.value.key);
  const existing = entries.find((entry) => normalizeKey(entry.key) === targetKey);
  if (existing) {
    return entries.map((entry) =>
      entry.id === existing.id
        ? {
            ...entry,
            key: validation.value.key,
            content: validation.value.content,
            source: validation.value.source,
            updatedAt: now
          }
        : entry
    );
  }
  return [createMemoryEntry(input, now), ...entries];
}

/** Remove a memory by key (case-insensitive). */
export function removeMemory(entries: MemoryEntry[], key: string): MemoryEntry[] {
  const target = normalizeKey(key);
  return entries.filter((entry) => normalizeKey(entry.key) !== target);
}

export function findMemory(entries: MemoryEntry[], query: string): MemoryEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(
    (entry) => entry.key.toLowerCase().includes(q) || entry.content.toLowerCase().includes(q)
  );
}

export function isMemoryEntry(value: unknown): value is MemoryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<MemoryEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.key === "string" &&
    entry.key.trim().length > 0 &&
    typeof entry.content === "string" &&
    entry.source !== undefined &&
    memorySources.includes(entry.source) &&
    typeof entry.createdAt === "string" &&
    typeof entry.updatedAt === "string"
  );
}

/** Render memories for an AI prompt, capped to a character budget. */
export function formatMemoriesForPrompt(entries: MemoryEntry[], maxChars = 4000): string {
  if (entries.length === 0) return "";
  const lines = [...entries]
    .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1))
    .map((entry) => `- ${entry.key}: ${entry.content}`);
  const text = `## Saved memories\n${lines.join("\n")}`;
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n…(truncated)` : text;
}
