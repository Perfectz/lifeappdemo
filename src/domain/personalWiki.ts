import type { IsoDateTime } from "@/domain/types";

/**
 * A personal "About Me" wiki — a curated, human-authored knowledge base the
 * agents read for context (Karpathy's LLM-wiki pattern, applied to the user).
 * Stored locally + synced; never committed to source.
 */

export type WikiSectionId =
  | "profile"
  | "health"
  | "nutrition"
  | "training"
  | "goals"
  | "preferences"
  | "people"
  | "constraints"
  | "other";

export type PersonalWiki = {
  sections: Record<WikiSectionId, string>;
  updatedAt: IsoDateTime;
};

export const WIKI_SECTIONS: { id: WikiSectionId; title: string; hint: string }[] = [
  { id: "profile", title: "Profile", hint: "Who you are, the basics, your why" },
  { id: "health", title: "Health", hint: "Conditions, meds, vitals targets, injuries" },
  { id: "nutrition", title: "Nutrition", hint: "How you eat, constraints, goals" },
  { id: "training", title: "Training & Activity", hint: "Experience, equipment, the split, preferences" },
  { id: "goals", title: "Goals", hint: "Short- and long-term, across life areas" },
  { id: "preferences", title: "Coaching Preferences", hint: "Tone, push level, detail, motivators" },
  { id: "people", title: "People & Context", hint: "Who and what matters" },
  { id: "constraints", title: "Constraints & Schedule", hint: "Time, energy, hard limits" },
  { id: "other", title: "Other", hint: "Anything else worth knowing" }
];

const SECTION_IDS = WIKI_SECTIONS.map((section) => section.id);

export function emptyWiki(now: IsoDateTime = new Date().toISOString()): PersonalWiki {
  const sections = {} as Record<WikiSectionId, string>;
  for (const { id } of WIKI_SECTIONS) sections[id] = "";
  return { sections, updatedAt: now };
}

export function isPersonalWiki(value: unknown): value is PersonalWiki {
  if (!value || typeof value !== "object") return false;
  const wiki = value as Partial<PersonalWiki>;
  if (!wiki.sections || typeof wiki.sections !== "object") return false;
  if (typeof wiki.updatedAt !== "string") return false;
  return SECTION_IDS.every((id) => typeof (wiki.sections as Record<string, unknown>)[id] === "string");
}

export function isWikiEmpty(wiki: PersonalWiki): boolean {
  return SECTION_IDS.every((id) => wiki.sections[id].trim() === "");
}

/** Match a freeform markdown heading (e.g. "Health (priority)") to a section id. */
function sectionIdForHeading(heading: string): WikiSectionId | null {
  const text = heading.toLowerCase();
  if (text.includes("profile")) return "profile";
  if (text.includes("health")) return "health";
  if (text.includes("nutrition") || text.includes("food") || text.includes("diet")) return "nutrition";
  if (text.includes("training") || text.includes("activity") || text.includes("workout") || text.includes("fitness")) return "training";
  if (text.includes("goal")) return "goals";
  if (text.includes("preference") || text.includes("coach")) return "preferences";
  if (text.includes("people") || text.includes("context")) return "people";
  if (text.includes("constraint") || text.includes("schedule")) return "constraints";
  if (text.includes("anything else") || text.includes("other")) return "other";
  return null;
}

/** Parse a markdown dump with "## Section" headings into section content. */
export function parseWikiMarkdown(markdown: string): Partial<Record<WikiSectionId, string>> {
  const lines = markdown.split(/\r?\n/);
  const result: Partial<Record<WikiSectionId, string>> = {};
  let current: WikiSectionId | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (current) {
      const text = buffer.join("\n").trim();
      if (text) result[current] = result[current] ? `${result[current]}\n${text}` : text;
    }
    buffer = [];
  };

  for (const line of lines) {
    const heading = /^#{1,6}\s+(.+?)\s*$/.exec(line);
    if (heading) {
      flush();
      current = sectionIdForHeading(heading[1]);
      continue;
    }
    if (current) buffer.push(line);
  }
  flush();
  return result;
}

/** Render the wiki for an agent prompt, capped to a character budget. */
export function formatWikiForPrompt(wiki: PersonalWiki, maxChars = 6000): string {
  const blocks = WIKI_SECTIONS.filter((section) => wiki.sections[section.id].trim()).map(
    (section) => `## ${section.title}\n${wiki.sections[section.id].trim()}`
  );
  if (blocks.length === 0) return "";
  const text = blocks.join("\n\n");
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n…(truncated)` : text;
}
