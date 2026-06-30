/**
 * Canonical "who I'm becoming" resolver.
 *
 * The future-self / Ideal-vs-Warning identity used to be defined in several
 * disconnected places (the personal wiki, the goal image, the Timeline Mirror
 * docs). This module makes the resolution order explicit and shared so every
 * feature reads ONE identity:
 *
 *   1. Timeline identity docs, if the user wrote them (most specific).
 *   2. Otherwise derived from the personal wiki ("About Me" goals + profile),
 *      so the future self you described to the coach also drives the Mirror.
 *   3. Otherwise sensible generic defaults.
 */

import { loadWiki } from "@/data/wikiRepository";
import { getTimelineIdentityDoc } from "@/data/timelineIdentityRepository";
import type { PersonalWiki } from "@/domain/personalWiki";

/** Default identity rubrics so the feature is useful before anything is set. */
export const DEFAULT_IDEAL_MARKDOWN = `# Ideal Timeline — the best version

The hero who is winning the long game:

- Leaner and stronger, posture tall and open
- Better grooming and executive presence
- More martial-artist energy and discipline
- Consistent: trains, logs food, sleeps well, shows up daily
- Weight trending toward the goal, momentum building
- Looks like someone who clearly decided who they are becoming`;

export const DEFAULT_WARNING_MARKDOWN = `# Warning Timeline — the version to avoid

NOT simply the current weight — the hero can look capable and healthy now.
This is the *trajectory of neglect*:

- Letting the current weight become the floor and drifting heavier
- Poor posture, low-energy appearance, avoiding photos
- Inconsistent habits, little movement, skipped training
- Poor nutrition adherence and poor sleep
- Losing momentum, living in "tomorrow mode"
- The slow slide that turns a capable body into a cautionary side quest`;

export type IdentitySource = "timeline_docs" | "wiki" | "default";

export type ResolvedIdentity = {
  idealMarkdown: string;
  warningMarkdown: string;
  /** Where the ideal narrative came from — useful for UI hints. */
  source: IdentitySource;
};

/** Build an Ideal-version rubric from the wiki's goals + profile sections. */
function wikiToIdealMarkdown(wiki: PersonalWiki): string | null {
  const goals = wiki.sections.goals?.trim();
  const profile = wiki.sections.profile?.trim();
  if (!goals && !profile) return null;
  return [
    "# Ideal Version — from your About Me",
    profile ? `## Who I am\n${profile}` : "",
    goals ? `## Goals\n${goals}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Resolve the canonical Ideal/Warning narrative for the user. Pure read; safe
 * to call anywhere a feature needs to know "who is this person becoming?".
 */
export function resolveIdentity(
  storage: Storage = typeof window !== "undefined" ? window.localStorage : ({} as Storage)
): ResolvedIdentity {
  const ideal = getTimelineIdentityDoc("ideal_version");
  const warning = getTimelineIdentityDoc("warning_version");

  if (ideal?.markdownContent?.trim() || warning?.markdownContent?.trim()) {
    return {
      idealMarkdown: ideal?.markdownContent?.trim() || DEFAULT_IDEAL_MARKDOWN,
      warningMarkdown: warning?.markdownContent?.trim() || DEFAULT_WARNING_MARKDOWN,
      source: "timeline_docs"
    };
  }

  try {
    const wikiIdeal = wikiToIdealMarkdown(loadWiki(storage));
    if (wikiIdeal) {
      return {
        idealMarkdown: wikiIdeal,
        warningMarkdown: DEFAULT_WARNING_MARKDOWN,
        source: "wiki"
      };
    }
  } catch {
    // fall through to defaults
  }

  return {
    idealMarkdown: DEFAULT_IDEAL_MARKDOWN,
    warningMarkdown: DEFAULT_WARNING_MARKDOWN,
    source: "default"
  };
}
