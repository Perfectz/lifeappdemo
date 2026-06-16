import { describe, expect, it } from "vitest";

import type { Note } from "@/domain";
import {
  createNote,
  deleteNote,
  getRecentNotes,
  isNote,
  parseNoteTags,
  searchNotes,
  updateNote,
  validateNoteInput
} from "@/domain/notes";

const now = "2026-06-16T12:00:00.000Z";

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "note-1",
    title: "Strategy",
    content: "Keep a scratchpad for loose ideas.",
    tags: ["planning"],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("Note validation", () => {
  it("accepts and normalizes valid note input", () => {
    expect(
      validateNoteInput({
        title: " Daily idea ",
        content: " Write it down. ",
        tags: [" Planning ", "planning", "Ideas"]
      })
    ).toEqual({
      ok: true,
      value: {
        title: "Daily idea",
        content: "Write it down.",
        tags: ["planning", "ideas"]
      }
    });
  });

  it("rejects empty or oversized fields", () => {
    expect(validateNoteInput({ title: " ", content: "Body" })).toEqual({
      ok: false,
      message: "Note title is required."
    });
    expect(validateNoteInput({ title: "Title", content: " " })).toEqual({
      ok: false,
      message: "Note content is required."
    });
    expect(validateNoteInput({ title: "x".repeat(121), content: "Body" })).toEqual({
      ok: false,
      message: "Note title must be 120 characters or fewer."
    });
  });

  it("creates and updates notes", () => {
    const note = createNote(
      { title: "First", content: "Original body.", tags: ["idea"] },
      now
    );
    const updated = updateNote(
      note,
      { title: "Second", content: "Updated body.", tags: ["plan"] },
      "2026-06-16T13:00:00.000Z"
    );

    expect(note).toMatchObject({ title: "First", tags: ["idea"] });
    expect(updated).toMatchObject({
      id: note.id,
      title: "Second",
      content: "Updated body.",
      tags: ["plan"],
      createdAt: now,
      updatedAt: "2026-06-16T13:00:00.000Z"
    });
  });
});

describe("note collection helpers", () => {
  it("parses comma-separated tags", () => {
    expect(parseNoteTags("planning, Ideas, planning")).toEqual(["planning", "ideas"]);
  });

  it("sorts recent notes by update time", () => {
    expect(
      getRecentNotes([
        makeNote({ id: "old", updatedAt: "2026-06-16T09:00:00.000Z" }),
        makeNote({ id: "new", updatedAt: "2026-06-16T20:00:00.000Z" })
      ]).map((note) => note.id)
    ).toEqual(["new", "old"]);
  });

  it("searches title, content, and tags", () => {
    const notes = [
      makeNote({ id: "a", title: "Fitness", tags: ["health"] }),
      makeNote({ id: "b", title: "Work", content: "Draft proposal.", tags: ["client"] })
    ];

    expect(searchNotes(notes, "proposal").map((note) => note.id)).toEqual(["b"]);
    expect(searchNotes(notes, "health").map((note) => note.id)).toEqual(["a"]);
  });

  it("deletes notes by id and validates stored shape", () => {
    const note = makeNote();

    expect(deleteNote([note], note.id)).toEqual([]);
    expect(isNote(note)).toBe(true);
    expect(isNote({ ...note, content: "" })).toBe(false);
  });
});
