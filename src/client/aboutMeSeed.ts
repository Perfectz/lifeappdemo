/**
 * One-time seed of Patrick's "About Me" personal wiki — the curated context
 * the AI coaches read via formatWikiForPrompt (workout coach, nutrition
 * advice, weekly review, chat).
 *
 * Mirrors the timelineSeed pattern exactly:
 * - Gated to the owning account (signed-in Supabase session, email match) —
 *   never another user, never local-only mode.
 * - Applies only when the wiki is currently empty, so it can never clobber
 *   anything Patrick wrote himself.
 * - Idempotent via a localStorage flag; the flag is only set once the gate
 *   passes, so a signed-out visit doesn't burn the one shot — it retries on a
 *   later sign-in.
 */

import { getCurrentCloudUser, isCloudSyncConfigured } from "@/client/cloudSync";
import { loadWiki, saveWiki } from "@/data/wikiRepository";
import { emptyWiki, isWikiEmpty, type WikiSectionId } from "@/domain/personalWiki";

const SEED_FLAG = "lifequest.aboutMeSeed.v1";

// This personal context belongs to exactly one account. The seed only ever
// runs when this user is signed in.
const SEED_ACCOUNT_EMAIL = "pzgambo@gmail.com";

const SEED_SECTIONS: Partial<Record<WikiSectionId, string>> = {
  profile:
    "Patrick. Software builder who ships products with AI agents and documents the journey publicly (Builder's Journal / LinkedIn series). US Eastern time. Retro-JRPG fan — this app's aesthetic is his taste. GitHub: Perfectz.",
  health:
    "Tracks fasting glucose, blood pressure, and weight every morning. Takes morning and night medications plus supplements, logged daily in Vitals. Watching blood pressure (target ≈130/80) and fasting glucose (target ≈100). Weight is trending slowly down — protect that momentum. Sleep target ≈7.5h.",
  nutrition:
    "Goal: lose fat while preserving muscle — steady, sustainable calorie deficit. Logs food via search, barcode, and meal photos. Priorities: hit the daily protein target; keep dinner light on over-budget days.",
  training:
    "Three sessions a day: strength, cardio, martial arts. Strength follows coach Vinny's split (the 'Back to Basics' archive lives in the app): Day A Chest & Bis / Day B Back & Shoulders — main lift is 1 warm-up then 4 ascending triples, accessories 3×10–12, with Vinny's signature techniques (push-ups between chest sets, Bulgarian bag swings between back sets, preacher 21's). Karate classes count as the martial-arts session; solo conditioning (kata, bagwork, footwork) on non-class days. Tracks kettlebell swings cumulatively; walks, sometimes with a weight vest. Equipment: commercial gym access (barbell, rack, machines, cables) plus home kit — 25 lb kettlebell, adjustable dumbbells to 25 lb, bands, adjustable bench, Bulgarian bag.",
  goals:
    "Becoming the leaner, stronger future self — the Ideal Timeline. Current season: health and nutrition first; the quest log exists to support that, not the other way around. The app's Lv 50 transformation journey mirrors the real one.",
  preferences:
    "Program like Vinny: concrete numbers, short reasons, no fluff. Celebrate PRs loudly. Direct, warm, a little playful — JRPG flavor welcome.",
  people:
    "Vinny — former strength coach (April–September 2024). His workout emails are the gold standard for programming style.",
  constraints:
    "Works a day job — mornings are the reliable window for training and logging; keep morning flows fast and one-tap where possible."
};

export type AboutMeSeedResult = { seeded: boolean };

// Module-level guard so React StrictMode's double-invoked effect (and any
// concurrent mounts) share a single seed run instead of racing.
let inFlight: Promise<AboutMeSeedResult> | null = null;

async function isSeedAccount(): Promise<boolean> {
  // Require a configured + signed-in Supabase session whose email matches.
  if (!isCloudSyncConfigured()) return false;
  try {
    const user = await getCurrentCloudUser();
    return user?.email?.trim().toLowerCase() === SEED_ACCOUNT_EMAIL;
  } catch {
    return false;
  }
}

async function runSeed(): Promise<AboutMeSeedResult> {
  if (window.localStorage.getItem(SEED_FLAG)) {
    return { seeded: false };
  }
  // Gate strictly to the owning account — do NOT set the flag when it's
  // another user (or signed out), so the seed still runs later if Patrick
  // signs in.
  if (!(await isSeedAccount())) {
    return { seeded: false };
  }
  const existing = loadWiki(window.localStorage);
  if (!isWikiEmpty(existing)) {
    // Patrick already has wiki content — never overwrite it. Mark the seed
    // done so it doesn't keep re-checking forever.
    window.localStorage.setItem(SEED_FLAG, new Date().toISOString());
    return { seeded: false };
  }
  const wiki = emptyWiki();
  for (const [id, text] of Object.entries(SEED_SECTIONS)) {
    wiki.sections[id as WikiSectionId] = text;
  }
  // Save through the repository so data-changed events fire (sync, listeners).
  saveWiki(window.localStorage, wiki);
  window.localStorage.setItem(SEED_FLAG, new Date().toISOString());
  return { seeded: true };
}

/**
 * Seed Patrick's About Me wiki once. Safe to call on every mount — it no-ops
 * after the first run, for other accounts, and when the wiki already has
 * content.
 */
export async function seedAboutMeForPatrick(): Promise<AboutMeSeedResult> {
  if (typeof window === "undefined") return { seeded: false };
  if (inFlight) return inFlight;
  inFlight = runSeed()
    .catch(() => ({ seeded: false }))
    .then((result) => {
      // If the run bailed before setting the flag (signed out, wrong account,
      // or an error), release the guard so a later call — e.g. right after
      // Patrick signs in — retries instead of returning this no-op.
      if (!window.localStorage.getItem(SEED_FLAG)) inFlight = null;
      return result;
    });
  return inFlight;
}
