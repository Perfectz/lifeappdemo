import { afterEach, describe, expect, it } from "vitest";

import { resolveIdentity } from "@/client/identityProfile";
import { acceptTimelineQuest, timelineQuestToTaskInput } from "@/client/timelineQuest";
import { createLocalTaskRepository } from "@/data/taskRepository";
import { saveWiki } from "@/data/wikiRepository";
import { upsertTimelineIdentityDoc } from "@/data/timelineIdentityRepository";
import { toLocalIsoDate } from "@/domain/dates";
import { emptyWiki } from "@/domain/personalWiki";
import type { TimelineNextQuest } from "@/domain/timelineMirror";

function makeQuest(overrides: Partial<TimelineNextQuest> = {}): TimelineNextQuest {
  return {
    title: "20-Minute Walk + Protein Anchor",
    description: "Walk 20 minutes, make the next meal protein-first.",
    difficulty: "easy",
    xpReward: 35,
    category: "movement",
    ...overrides
  };
}

describe("timelineQuestToTaskInput", () => {
  it("maps difficulty to priority and tags it health", () => {
    expect(timelineQuestToTaskInput(makeQuest({ difficulty: "easy" })).priority).toBe("low");
    expect(timelineQuestToTaskInput(makeQuest({ difficulty: "medium" })).priority).toBe("medium");
    expect(timelineQuestToTaskInput(makeQuest({ difficulty: "hard" })).priority).toBe("high");
    expect(timelineQuestToTaskInput(makeQuest()).tags).toEqual(["health"]);
  });

  it("carries title, category, and plans it for today", () => {
    const input = timelineQuestToTaskInput(makeQuest({ category: "training" }));
    expect(input.title).toMatch(/20-Minute Walk/);
    expect(input.description).toMatch(/training/);
    expect(input.plannedForDate).toBe(toLocalIsoDate());
  });
});

describe("acceptTimelineQuest", () => {
  afterEach(() => window.localStorage.clear());

  it("creates a real quest in the Quest Log", () => {
    const task = acceptTimelineQuest(makeQuest());
    expect(task.status).toBe("todo");
    const stored = createLocalTaskRepository(window.localStorage).load();
    expect(stored.map((t) => t.id)).toContain(task.id);
    expect(stored[0].title).toMatch(/20-Minute Walk/);
  });
});

describe("resolveIdentity (canonical future self)", () => {
  afterEach(() => window.localStorage.clear());

  it("falls back to defaults when nothing is set", () => {
    const id = resolveIdentity(window.localStorage);
    expect(id.source).toBe("default");
    expect(id.idealMarkdown).toMatch(/Ideal Timeline/);
  });

  it("derives the ideal from the personal wiki when no Timeline docs exist", () => {
    const wiki = emptyWiki();
    wiki.sections.goals = "Become a lean 195lb martial artist.";
    saveWiki(window.localStorage, wiki);

    const id = resolveIdentity(window.localStorage);
    expect(id.source).toBe("wiki");
    expect(id.idealMarkdown).toMatch(/lean 195lb martial artist/);
  });

  it("prefers explicit Timeline identity docs over the wiki", () => {
    const wiki = emptyWiki();
    wiki.sections.goals = "Wiki goal text.";
    saveWiki(window.localStorage, wiki);
    const now = "2026-06-28T00:00:00.000Z";
    upsertTimelineIdentityDoc({
      id: "d1",
      docType: "ideal_version",
      title: "Ideal Version",
      markdownContent: "# Patrick 2.0 — the canonical doc",
      createdAt: now,
      updatedAt: now
    });

    const id = resolveIdentity(window.localStorage);
    expect(id.source).toBe("timeline_docs");
    expect(id.idealMarkdown).toMatch(/canonical doc/);
  });
});
