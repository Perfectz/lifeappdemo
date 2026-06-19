import { describe, expect, it } from "vitest";

import {
  createMemoryEntry,
  findMemory,
  formatMemoriesForPrompt,
  isMemoryEntry,
  removeMemory,
  upsertMemory
} from "@/domain/memory";

const now = "2026-06-19T12:00:00.000Z";

describe("agent memory", () => {
  it("creates a valid entry and guards shape", () => {
    const entry = createMemoryEntry({ key: "resume", content: "AI architect…", source: "agent" }, now);
    expect(entry.source).toBe("agent");
    expect(isMemoryEntry(entry)).toBe(true);
    expect(isMemoryEntry({ key: "x" })).toBe(false);
  });

  it("rejects empty key or content", () => {
    expect(() => createMemoryEntry({ key: "", content: "x" })).toThrow();
    expect(() => createMemoryEntry({ key: "k", content: "  " })).toThrow();
  });

  it("upserts by key case-insensitively (updates, not duplicates)", () => {
    let entries = upsertMemory([], { key: "Favorite Workouts", content: "Shidokan" }, now);
    expect(entries).toHaveLength(1);
    entries = upsertMemory(entries, { key: "favorite workouts", content: "Shidokan + kettlebell" }, now);
    expect(entries).toHaveLength(1);
    expect(entries[0].content).toContain("kettlebell");
  });

  it("removes a memory by key", () => {
    const entries = upsertMemory([], { key: "coffee", content: "oat latte" }, now);
    expect(removeMemory(entries, "COFFEE")).toHaveLength(0);
  });

  it("finds by key or content and formats for a prompt", () => {
    const entries = [
      createMemoryEntry({ key: "resume", content: "Head AI Architect" }, now),
      createMemoryEntry({ key: "diet", content: "low sodium" }, now)
    ];
    expect(findMemory(entries, "architect")).toHaveLength(1);
    const prompt = formatMemoriesForPrompt(entries);
    expect(prompt).toContain("## Saved memories");
    expect(prompt).toContain("resume: Head AI Architect");
  });

  it("formats empty memories as an empty string", () => {
    expect(formatMemoriesForPrompt([])).toBe("");
  });
});
