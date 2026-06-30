/**
 * Assembles the narrative + life-data context the Timeline Mirror sends to the
 * AI, reusing the existing coach context pipeline so the score reflects the
 * same app data the coach already understands (weight trend, calories, steps,
 * workouts, sleep, vitals, habits, journal, etc.).
 *
 * Runs on the client (the route is stateless, like the progress route), and
 * degrades gracefully: any missing data source just contributes less context.
 */

import {
  DEFAULT_IDEAL_MARKDOWN,
  DEFAULT_WARNING_MARKDOWN,
  resolveIdentity
} from "@/client/identityProfile";
import { loadStoredAppData } from "@/client/storedAppData";
import { loadWiki } from "@/data/wikiRepository";
import {
  buildAIAppContext,
  formatAIContextForPrompt
} from "@/domain/aiContext";
import { toLocalIsoDate } from "@/domain/dates";
import { formatWikiForPrompt, isWikiEmpty } from "@/domain/personalWiki";
import { loadTimelineIdentityDocs } from "@/data/timelineIdentityRepository";

// Re-exported so existing importers (e.g. the seeder) keep working while the
// canonical definitions live in identityProfile.
export { DEFAULT_IDEAL_MARKDOWN, DEFAULT_WARNING_MARKDOWN };

export type TimelineContext = {
  profileContext?: string;
  lifeDataSummary?: string;
  idealMarkdown?: string;
  warningMarkdown?: string;
};

export function buildTimelineContext(storage: Storage = window.localStorage): TimelineContext {
  const today = toLocalIsoDate();

  // Profile / goal narrative from the personal wiki ("About Me").
  const wiki = loadWiki(storage);
  const profileContext = isWikiEmpty(wiki) ? undefined : formatWikiForPrompt(wiki);

  // Recent health/life data, formatted via the existing coach context pipeline.
  let lifeDataSummary: string | undefined;
  try {
    const appData = loadStoredAppData(storage);
    const context = buildAIAppContext(appData, today);
    const formatted = formatAIContextForPrompt(context).trim();
    lifeDataSummary = formatted || undefined;
  } catch {
    lifeDataSummary = undefined;
  }

  // Identity rubric from the single canonical resolver (Timeline docs → wiki →
  // defaults), so the Mirror judges against the same future self the rest of
  // the app knows about.
  const identity = resolveIdentity(storage);

  return {
    profileContext,
    lifeDataSummary,
    idealMarkdown: identity.idealMarkdown,
    warningMarkdown: identity.warningMarkdown
  };
}

/** Whether the user has stored any custom identity docs yet. */
export function hasCustomIdentityDocs(): boolean {
  return loadTimelineIdentityDocs().length > 0;
}
