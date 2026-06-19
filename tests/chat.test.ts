import { describe, expect, it } from "vitest";

import {
  deriveThreadTitle,
  isChatThread,
  removeThread,
  sortThreadsByRecent,
  upsertThread,
  type ChatThread
} from "@/domain/chat";

function thread(overrides: Partial<ChatThread>): ChatThread {
  const updatedAt = overrides.updatedAt ?? "2026-06-19T10:00:00.000Z";
  return {
    id: overrides.id ?? "t1",
    title: overrides.title ?? "Chat",
    messages: overrides.messages ?? [{ id: "m1", role: "user", content: "Hi" }],
    createdAt: overrides.createdAt ?? updatedAt,
    updatedAt,
    ...overrides
  };
}

describe("chat threads", () => {
  it("derives a title from the first user message", () => {
    expect(
      deriveThreadTitle([
        { id: "a", role: "coach", content: "Hello" },
        { id: "b", role: "user", content: "What should I eat for breakfast?" }
      ])
    ).toBe("What should I eat for breakfast?");
    expect(deriveThreadTitle([{ id: "a", role: "coach", content: "Hi" }])).toBe("New chat");
    expect(deriveThreadTitle([{ id: "b", role: "user", content: "x".repeat(80) }]).length).toBeLessThanOrEqual(
      49
    );
  });

  it("upserts by id and keeps the newest first", () => {
    const a = thread({ id: "a", updatedAt: "2026-06-18T10:00:00.000Z" });
    const b = thread({ id: "b", updatedAt: "2026-06-19T10:00:00.000Z" });
    let list = upsertThread([a], b);
    expect(list.map((t) => t.id)).toEqual(["b", "a"]);
    // Updating "a" with a newer timestamp moves it to the front, no duplicate.
    list = upsertThread(list, thread({ id: "a", updatedAt: "2026-06-20T10:00:00.000Z" }));
    expect(list.map((t) => t.id)).toEqual(["a", "b"]);
    expect(list).toHaveLength(2);
  });

  it("removes a thread by id", () => {
    expect(removeThread([thread({ id: "a" }), thread({ id: "b" })], "a").map((t) => t.id)).toEqual(["b"]);
  });

  it("sorts by most recently updated", () => {
    const a = thread({ id: "a", updatedAt: "2026-06-17T10:00:00.000Z" });
    const b = thread({ id: "b", updatedAt: "2026-06-19T10:00:00.000Z" });
    expect(sortThreadsByRecent([a, b]).map((t) => t.id)).toEqual(["b", "a"]);
  });

  it("guards thread shape", () => {
    expect(isChatThread(thread({}))).toBe(true);
    expect(isChatThread({ id: "x", title: "y", messages: [{ bad: true }], createdAt: "n", updatedAt: "n" })).toBe(
      false
    );
    expect(isChatThread(null)).toBe(false);
  });
});
