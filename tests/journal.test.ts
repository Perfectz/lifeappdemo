import { describe, expect, it } from "vitest";

import type { JournalEntry } from "@/domain";
import {
  createJournalEntry,
  deleteJournalEntry,
  getJournalEntriesForDate,
  getRecentJournalEntries,
  isJournalEntry,
  updateJournalEntry,
  validateJournalEntryInput
} from "@/domain/journal";

const today = "2026-05-04";
const now = "2026-05-04T12:00:00.000Z";

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: "journal-1",
    date: today,
    type: "lesson",
    prompt: "What did I learn today?",
    content: "Small loops beat vague ambition.",
    source: "manual",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("JournalEntry validation", () => {
  it("accepts valid manual journal input", () => {
    const validation = validateJournalEntryInput({
      date: today,
      type: "lesson",
      prompt: " What did I learn today? ",
      content: " Keep the loop small. "
    });

    expect(validation).toEqual({
      ok: true,
      value: {
        date: today,
        type: "lesson",
        prompt: "What did I learn today?",
        content: "Keep the loop small.",
        linkedDailyPlanId: undefined,
        linkedPostmortemId: undefined
      }
    });
  });

  it("rejects empty or oversized content", () => {
    expect(
      validateJournalEntryInput({ date: today, type: "freeform", content: " " })
    ).toEqual({ ok: false, message: "Journal content is required." });

    expect(
      validateJournalEntryInput({
        date: today,
        type: "freeform",
        content: "x".repeat(10_001)
      })
    ).toEqual({ ok: false, message: "Journal content must be 10,000 characters or fewer." });
  });

  it("creates and updates manual entries", () => {
    const entry = createJournalEntry(
      { date: today, type: "freeform", content: "First draft." },
      now
    );
    const updated = updateJournalEntry(
      entry,
      { date: today, type: "lesson", content: "Better lesson." },
      "2026-05-04T13:00:00.000Z"
    );

    expect(entry).toMatchObject({ source: "manual", content: "First draft." });
    expect(updated).toMatchObject({
      id: entry.id,
      type: "lesson",
      content: "Better lesson.",
      createdAt: now,
      updatedAt: "2026-05-04T13:00:00.000Z"
    });
  });
});

describe("journal collection helpers", () => {
  it("filters entries by date", () => {
    expect(
      getJournalEntriesForDate(
        [makeEntry({ id: "today" }), makeEntry({ id: "tomorrow", date: "2026-05-05" })],
        today
      ).map((entry) => entry.id)
    ).toEqual(["today"]);
  });

  it("sorts recent entries by update time", () => {
    expect(
      getRecentJournalEntries([
        makeEntry({ id: "old", updatedAt: "2026-05-04T09:00:00.000Z" }),
        makeEntry({ id: "new", updatedAt: "2026-05-04T20:00:00.000Z" })
      ]).map((entry) => entry.id)
    ).toEqual(["new", "old"]);
  });

  it("deletes entries by id and validates stored shape", () => {
    const entry = makeEntry();

    expect(deleteJournalEntry([entry], entry.id)).toEqual([]);
    expect(isJournalEntry(entry)).toBe(true);
    expect(isJournalEntry({ ...entry, content: "" })).toBe(false);
  });
});
