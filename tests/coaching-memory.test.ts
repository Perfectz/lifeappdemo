import { describe, expect, it } from "vitest";

import { validateAIToolProposalInput } from "@/domain/aiTaskTools";
import {
  createMemoryEntry,
  formatMemoriesForPrompt,
  isMemoryEntry,
  upsertMemory,
  validateMemoryInput,
  type MemoryEntry
} from "@/domain/memory";

describe("memory categories", () => {
  it("defaults to general and accepts valid categories", () => {
    const def = validateMemoryInput({ key: "k", content: "c" });
    expect(def.ok && def.value.category).toBe("general");

    const med = validateMemoryInput({ key: "lisinopril", content: "10mg daily", category: "medication" });
    expect(med.ok && med.value.category).toBe("medication");

    const bad = validateMemoryInput({
      key: "k",
      content: "c",
      category: "bogus" as never
    });
    expect(bad.ok && bad.value.category).toBe("general");
  });

  it("preserves category through upsert", () => {
    let entries = upsertMemory([], { key: "right knee", content: "avoid deep lunges", category: "injury" });
    expect(entries[0].category).toBe("injury");
    // update keeps the new category
    entries = upsertMemory(entries, { key: "right knee", content: "cleared by PT", category: "injury" });
    expect(entries).toHaveLength(1);
    expect(entries[0].content).toMatch(/cleared/);
  });

  it("accepts legacy uncategorized entries (backward compatible)", () => {
    const legacy = {
      id: "m1",
      key: "resume",
      content: "AI Architect",
      source: "user",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z"
    };
    expect(isMemoryEntry(legacy)).toBe(true);
    // and rejects an invalid category
    expect(isMemoryEntry({ ...legacy, category: "nope" })).toBe(false);
  });

  it("groups the prompt with safety-critical categories first", () => {
    const now = "2026-06-28T00:00:00.000Z";
    const entries: MemoryEntry[] = [
      createMemoryEntry({ key: "likes eggs", content: "protein-first", category: "nutrition" }, now),
      createMemoryEntry({ key: "lisinopril", content: "10mg for BP", category: "medication" }, now),
      createMemoryEntry({ key: "misc", content: "no category here", category: undefined }, now)
    ];
    const prompt = formatMemoriesForPrompt(entries);
    expect(prompt).toContain("### Medications");
    expect(prompt).toContain("### Nutrition");
    expect(prompt).toContain("### General");
    // medication block comes before nutrition block (safety-critical first)
    expect(prompt.indexOf("### Medications")).toBeLessThan(prompt.indexOf("### Nutrition"));
  });
});

describe("save_memory tool carries category", () => {
  it("validates a category through the proposal layer", () => {
    const result = validateAIToolProposalInput({
      toolName: "save_memory",
      summary: "Remember: right knee",
      payload: { key: "right knee", content: "avoid deep lunges", category: "injury" }
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value.payload as { category?: string }).category).toBe("injury");
    }
  });

  it("drops an invalid category but keeps the memory", () => {
    const result = validateAIToolProposalInput({
      toolName: "save_memory",
      summary: "Remember: thing",
      payload: { key: "thing", content: "stuff", category: "bogus" }
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value.payload as { category?: string }).category).toBeUndefined();
    }
  });
});
