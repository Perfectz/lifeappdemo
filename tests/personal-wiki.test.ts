import { describe, expect, it } from "vitest";

import {
  emptyWiki,
  formatWikiForPrompt,
  isPersonalWiki,
  isWikiEmpty,
  parseWikiMarkdown
} from "@/domain/personalWiki";

describe("personal wiki", () => {
  it("creates an empty wiki and detects emptiness", () => {
    const wiki = emptyWiki("2026-06-17T00:00:00.000Z");
    expect(isPersonalWiki(wiki)).toBe(true);
    expect(isWikiEmpty(wiki)).toBe(true);
  });

  it("parses a markdown dump into matching sections (incl. variant headings)", () => {
    const markdown = [
      "## Profile",
      "Name: Patrick.",
      "## Health (priority)",
      "BP 212/130 in Jan 2026.",
      "## Training & Activity",
      "Shidokan karate.",
      "## Anything else important",
      "Uses AI heavily."
    ].join("\n");

    const parsed = parseWikiMarkdown(markdown);
    expect(parsed.profile).toContain("Patrick");
    expect(parsed.health).toContain("212/130");
    expect(parsed.training).toContain("karate");
    expect(parsed.other).toContain("AI");
  });

  it("formats non-empty sections for a prompt and truncates to budget", () => {
    const wiki = emptyWiki();
    wiki.sections.profile = "Patrick, 41.";
    wiki.sections.health = "Working on BP, glucose, weight.";
    const text = formatWikiForPrompt(wiki);
    expect(text).toContain("## Profile");
    expect(text).toContain("## Health");
    expect(text).not.toContain("## Goals"); // empty sections omitted

    wiki.sections.other = "x".repeat(500);
    expect(formatWikiForPrompt(wiki, 100).length).toBeLessThanOrEqual(120);
  });

  it("rejects malformed wikis", () => {
    expect(isPersonalWiki({ sections: { profile: "x" }, updatedAt: "now" })).toBe(false);
    expect(isPersonalWiki(null)).toBe(false);
  });
});
