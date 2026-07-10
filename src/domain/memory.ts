import type { IsoDateTime } from "@/domain/types";

/**
 * Agent-writable long-term memory (Karpathy "LLM memory / wiki" style): a
 * growing set of keyed facts the AI agent — or the user — can store and recall
 * across sessions. Distinct from the hand-authored About Me wiki: this is the
 * flexible, append-as-you-go notebook the coach fills by *talking* to you, so
 * you never have to manage a profile form.
 *
 * Facts are categorized so the coach can respect the safety-sensitive ones
 * (medications, conditions, injuries) as user-reported constraints and the user can scan
 * "what the coach knows" at a glance.
 */

export const memorySources = ["user", "agent"] as const;
export type MemorySource = (typeof memorySources)[number];

/** Coaching/clinical buckets. Order matters: safety-critical first. */
export const memoryCategories = [
  "medication",
  "condition",
  "injury",
  "training",
  "nutrition",
  "equipment",
  "schedule",
  "preference",
  "goal",
  "general"
] as const;
export type MemoryCategory = (typeof memoryCategories)[number];

export const memoryCategoryLabel: Record<MemoryCategory, string> = {
  medication: "Medications",
  condition: "Conditions",
  injury: "Injuries & limits",
  training: "Training",
  nutrition: "Nutrition",
  equipment: "Equipment & access",
  schedule: "Schedule & constraints",
  preference: "Preferences",
  goal: "Goals",
  general: "General"
};

/** Categories the coach must respect as user-reported safety constraints. */
export const SAFETY_CRITICAL_CATEGORIES: MemoryCategory[] = ["medication", "condition", "injury"];

export const DEFAULT_MEMORY_CATEGORY: MemoryCategory = "general";

export type MemoryEntry = {
  id: string;
  /** Short topic/title used as the upsert identity, e.g. "right knee". */
  key: string;
  content: string;
  category: MemoryCategory;
  source: MemorySource;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type MemoryInput = {
  key: string;
  content: string;
  category?: MemoryCategory;
  source?: MemorySource;
};

export type MemoryValidationResult =
  | {
      ok: true;
      value: { key: string; content: string; category: MemoryCategory; source: MemorySource };
    }
  | { ok: false; message: string };

const MAX_KEY = 80;
const MAX_CONTENT = 4000;

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

export function isMemoryCategory(value: unknown): value is MemoryCategory {
  return typeof value === "string" && memoryCategories.includes(value as MemoryCategory);
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
  const category = isMemoryCategory(input.category) ? input.category : DEFAULT_MEMORY_CATEGORY;
  return {
    ok: true,
    value: { key: key.slice(0, MAX_KEY), content: content.slice(0, MAX_CONTENT), category, source }
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
    category: validation.value.category,
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
            category: validation.value.category,
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

/** Back-compatible read of a possibly-uncategorized stored entry. */
export function memoryCategoryOf(entry: MemoryEntry): MemoryCategory {
  return isMemoryCategory(entry.category) ? entry.category : DEFAULT_MEMORY_CATEGORY;
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
    // category is optional for backward compatibility with v1 memories.
    (entry.category === undefined || isMemoryCategory(entry.category)) &&
    typeof entry.createdAt === "string" &&
    typeof entry.updatedAt === "string"
  );
}

/**
 * Render memories for an AI prompt, grouped by category (safety-critical first)
 * so the coach can reliably find and honor medications/conditions/injuries.
 */
export function formatMemoriesForPrompt(entries: MemoryEntry[], maxChars = 4000): string {
  if (entries.length === 0) return "";

  const byCategory = new Map<MemoryCategory, MemoryEntry[]>();
  for (const entry of entries) {
    const cat = memoryCategoryOf(entry);
    const list = byCategory.get(cat) ?? [];
    list.push(entry);
    byCategory.set(cat, list);
  }

  const blocks: string[] = [];
  for (const cat of memoryCategories) {
    const list = byCategory.get(cat);
    if (!list || list.length === 0) continue;
    const lines = [...list]
      .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1))
      .map((entry) => `- ${entry.key}: ${entry.content}`);
    blocks.push(`### ${memoryCategoryLabel[cat]}\n${lines.join("\n")}`);
  }

  const text = `## What I know about you\n${blocks.join("\n")}`;
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n…(truncated)` : text;
}
