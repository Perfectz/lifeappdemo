/**
 * Resolves the "Week in Review" for a given week: deterministic aggregation
 * (buildWeeklyReview) → optional AI narrative in a coach tone (clamped to the
 * deterministic wins/focus) → cached per week + data signature, so the review
 * refreshes when the week's data changes but never re-hits the paid API per
 * render. Falls back to the deterministic narrative whenever the AI is
 * unavailable.
 */

import { getAuthHeaders } from "@/client/authToken";
import { createDailyNutritionTargetRepository } from "@/data/dailyNutritionTargetRepository";
import { createLocalFoodEntryRepository } from "@/data/foodEntryRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalTaskRepository } from "@/data/taskRepository";
import { createLocalWorkoutRepository } from "@/data/workoutRepository";
import { loadWiki } from "@/data/wikiRepository";
import { toLocalIsoDate } from "@/domain/dates";
import { formatWikiForPrompt, isWikiEmpty } from "@/domain/personalWiki";
import {
  addDaysIso,
  buildDeterministicWeeklyNarrative,
  buildWeeklyReview,
  isWeeklyReviewNarrative,
  weekStartOf,
  type WeeklyReview,
  type WeeklyReviewNarrative
} from "@/domain/weeklyReview";
import type { IsoDate } from "@/domain/types";

const CACHE_KEY = "lifequest.weeklyReview.v1";
/** Weeks kept in the cache (this week + a few of history). */
const MAX_CACHED_WEEKS = 6;

export type WeeklyReviewResult = {
  review: WeeklyReview;
  narrative: WeeklyReviewNarrative;
};

type CachedWeek = { signature: string; review: WeeklyReview; narrative: WeeklyReviewNarrative };
type CacheShape = Record<string, CachedWeek>;

/** Monday of the current (local) week. */
export function currentWeekStart(): IsoDate {
  return weekStartOf(toLocalIsoDate());
}

type WeekData = Parameters<typeof buildWeeklyReview>[0];

function loadWeekData(storage: Storage, weekStart: IsoDate): WeekData {
  return {
    weekStart,
    workouts: createLocalWorkoutRepository(storage).load(),
    metrics: createLocalMetricRepository(storage).load(),
    foodEntries: createLocalFoodEntryRepository(storage).load(),
    targets: createDailyNutritionTargetRepository(storage).load(),
    tasks: createLocalTaskRepository(storage).load(),
    today: toLocalIsoDate()
  };
}

/**
 * The week-state fingerprint the cache is keyed on: in-range record counts and
 * calorie/weight totals — so logging a workout, meal, metric, or quest inside
 * the week refreshes the review, while re-renders (and edits to other weeks)
 * don't.
 */
export function buildWeeklyReviewSignature(weekStart: IsoDate, data: WeekData): string {
  const start = weekStartOf(weekStart);
  const end = addDaysIso(start, 6);
  const inRange = (date: IsoDate) => date >= start && date <= end;

  const workouts = data.workouts.filter((w) => inRange(w.date));
  const setCount = workouts.reduce((total, w) => total + (w.sets?.length ?? 0), 0);
  const food = data.foodEntries.filter((f) => inRange(f.date));
  const calories = food.reduce((total, f) => total + (f.macros.calories ?? 0), 0);
  const metrics = data.metrics.filter((m) => inRange(m.date));
  const targets = data.targets.filter((t) => inRange(t.date));
  const targetCalories = targets.reduce((total, t) => total + t.calorieTarget, 0);
  const done = data.tasks.filter(
    (t) => t.completedAt !== undefined && inRange(t.completedAt.slice(0, 10))
  ).length;
  const planned = data.tasks.filter(
    (t) => t.plannedForDate !== undefined && inRange(t.plannedForDate)
  ).length;

  return [
    start,
    workouts.length,
    setCount,
    food.length,
    Math.round(calories),
    metrics.length,
    targets.length,
    Math.round(targetCalories),
    done,
    planned,
    // Partial-week session targets move as the week advances.
    toLocalIsoDate()
  ].join("|");
}

function readCache(storage: Storage): CacheShape {
  let raw: string | null;
  try {
    raw = storage.getItem(CACHE_KEY);
  } catch {
    return {};
  }
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const cache: CacheShape = {};
    for (const [weekStart, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (!entry || typeof entry !== "object") continue;
      const candidate = entry as Partial<CachedWeek>;
      if (
        typeof candidate.signature === "string" &&
        candidate.review &&
        typeof candidate.review === "object" &&
        isWeeklyReviewNarrative(candidate.narrative)
      ) {
        cache[weekStart] = candidate as CachedWeek;
      }
    }
    return cache;
  } catch {
    return {};
  }
}

// Written directly (not via createLocalRepository) so saving the review does
// NOT dispatch the data-changed event — dashboards reload on that event, and a
// cache write must never trigger the recompute that produced it.
function writeCache(storage: Storage, weekStart: IsoDate, entry: CachedWeek): void {
  const cache = readCache(storage);
  cache[weekStart] = entry;
  const keep = Object.keys(cache).sort().slice(-MAX_CACHED_WEEKS);
  const bounded: CacheShape = {};
  for (const key of keep) bounded[key] = cache[key];
  try {
    storage.setItem(CACHE_KEY, JSON.stringify(bounded));
  } catch {
    // Cache-only data — losing it just means one extra recompute.
  }
}

/**
 * The deterministic review + narrative, synchronously — so the UI can render
 * immediately while the AI rewrite (if any) loads.
 */
export function buildLocalWeeklyReview(
  storage: Storage,
  weekStart: IsoDate
): WeeklyReviewResult {
  const review = buildWeeklyReview(loadWeekData(storage, weekStart));
  return { review, narrative: buildDeterministicWeeklyNarrative(review) };
}

// Module-level guard so React StrictMode's double-invoked effect (and any
// concurrent callers) share one compute per week state instead of racing
// duplicate paid AI calls. Same pattern as nutritionAdvice.
let inFlight: { signature: string; promise: Promise<WeeklyReviewResult> } | null = null;

/**
 * The review for the week starting `weekStart` — cached per (week + data
 * signature), else computed (AI-narrated when available, deterministic
 * otherwise).
 */
export async function getOrComputeWeeklyReview(
  weekStart: IsoDate,
  storage: Storage = window.localStorage
): Promise<WeeklyReviewResult> {
  const start = weekStartOf(weekStart);
  const data = loadWeekData(storage, start);
  const signature = buildWeeklyReviewSignature(start, data);

  const cached = readCache(storage)[start];
  if (cached && cached.signature === signature) {
    return { review: cached.review, narrative: cached.narrative };
  }

  if (inFlight?.signature === signature) return inFlight.promise;
  const promise = computeWeeklyReview(storage, start, data, signature).finally(() => {
    if (inFlight?.promise === promise) inFlight = null;
  });
  inFlight = { signature, promise };
  return promise;
}

async function computeWeeklyReview(
  storage: Storage,
  weekStart: IsoDate,
  data: WeekData,
  signature: string
): Promise<WeeklyReviewResult> {
  const review = buildWeeklyReview(data);
  const deterministic = buildDeterministicWeeklyNarrative(review);

  // An empty week has nothing to narrate — not worth a paid AI call.
  let narrative = deterministic;
  if (!review.emptyWeek) {
    try {
      const wiki = loadWiki(storage);
      const response = await fetch("/api/ai/weekly-review", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({
          weekStart,
          review,
          deterministic,
          profileContext: isWikiEmpty(wiki) ? undefined : formatWikiForPrompt(wiki, 2_000)
        })
      });
      if (response.ok) {
        const parsed: unknown = await response.json();
        if (isWeeklyReviewNarrative(parsed) && parsed.weekStart === weekStart) {
          narrative = parsed;
        }
      }
    } catch {
      // Network/AI down — keep the deterministic narrative.
    }
  }

  writeCache(storage, weekStart, { signature, review, narrative });
  return { review, narrative };
}

/** Exposed for tests/debugging: drop the cached reviews so the next call recomputes. */
export function clearWeeklyReviewCache(storage: Storage = window.localStorage): void {
  try {
    storage.removeItem(CACHE_KEY);
  } catch {
    // Ignore — cache only.
  }
}

export const weeklyReviewCacheKey = CACHE_KEY;
