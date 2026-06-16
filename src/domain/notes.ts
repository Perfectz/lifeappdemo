import type { EntityId, IsoDateTime, Note } from "@/domain/types";

const maxTitleLength = 120;
const maxContentLength = 20_000;
const maxTagLength = 32;

export type NoteInput = {
  title: string;
  content: string;
  tags?: string[];
};

export type NoteValidationResult =
  | { ok: true; value: NoteInput & { tags: string[] } }
  | { ok: false; message: string };

function normalizeTags(tags: string[] | undefined): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of tags ?? []) {
    const value = tag.trim().toLowerCase();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value.slice(0, maxTagLength));
  }

  return normalized.slice(0, 8);
}

export function parseNoteTags(value: string): string[] {
  return normalizeTags(value.split(","));
}

export function formatNoteTags(tags: string[]): string {
  return tags.join(", ");
}

export function validateNoteInput(input: NoteInput): NoteValidationResult {
  const title = input.title.trim();
  const content = input.content.trim();
  const tags = normalizeTags(input.tags);

  if (!title) {
    return { ok: false, message: "Note title is required." };
  }

  if (title.length > maxTitleLength) {
    return { ok: false, message: "Note title must be 120 characters or fewer." };
  }

  if (!content) {
    return { ok: false, message: "Note content is required." };
  }

  if (content.length > maxContentLength) {
    return { ok: false, message: "Note content must be 20,000 characters or fewer." };
  }

  return {
    ok: true,
    value: {
      title,
      content,
      tags
    }
  };
}

export function createNote(
  input: NoteInput,
  now: IsoDateTime = new Date().toISOString()
): Note {
  const validation = validateNoteInput(input);

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  return {
    id: globalThis.crypto?.randomUUID?.() ?? `note-${now}`,
    title: validation.value.title,
    content: validation.value.content,
    tags: validation.value.tags,
    createdAt: now,
    updatedAt: now
  };
}

export function updateNote(
  note: Note,
  input: NoteInput,
  now: IsoDateTime = new Date().toISOString()
): Note {
  const validation = validateNoteInput(input);

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  return {
    ...note,
    title: validation.value.title,
    content: validation.value.content,
    tags: validation.value.tags,
    updatedAt: now
  };
}

export function deleteNote(notes: Note[], noteId: EntityId): Note[] {
  return notes.filter((note) => note.id !== noteId);
}

export function getRecentNotes(notes: Note[], limit = 12): Note[] {
  return [...notes]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, limit);
}

export function searchNotes(notes: Note[], query: string): Note[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return getRecentNotes(notes);
  }

  return getRecentNotes(
    notes.filter((note) => {
      const haystack = `${note.title} ${note.content} ${note.tags.join(" ")}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    })
  );
}

export function isNote(value: unknown): value is Note {
  if (!value || typeof value !== "object") {
    return false;
  }

  const note = value as Partial<Note>;

  return (
    typeof note.id === "string" &&
    typeof note.title === "string" &&
    note.title.trim().length > 0 &&
    note.title.length <= maxTitleLength &&
    typeof note.content === "string" &&
    note.content.trim().length > 0 &&
    note.content.length <= maxContentLength &&
    Array.isArray(note.tags) &&
    note.tags.every((tag) => typeof tag === "string" && tag.length <= maxTagLength) &&
    typeof note.createdAt === "string" &&
    typeof note.updatedAt === "string"
  );
}
