import { toLocalIsoDate } from "@/domain/dates";
import { createFoodEntry } from "@/domain/nutrition";
import type { FoodEntry, IsoDate, IsoDateTime, Macros, MealType } from "@/domain/types";

/**
 * Friction killers for food logging: "you ate this recently / you eat this
 * all the time" templates computed from diary history, plus copy-yesterday.
 * Pure functions — the diary component wires them to the repository.
 */

export type QuickAddFood = {
  /** Display name, taken from the most recent occurrence. */
  name: string;
  calories: number;
  macros: Macros;
  /** Meal the food was last logged to (a hint, not a constraint). */
  lastMeal: MealType;
};

export type QuickAddWindowOptions = {
  /** Reference date ("today"); defaults to the local calendar date. */
  today?: IsoDate;
  days?: number;
  limit?: number;
};

/** Dedupe identity: same normalized name at (roughly) the same calories. */
function quickAddKey(description: string, calories: number | undefined): string {
  const name = description.trim().toLowerCase().replace(/\s+/g, " ");
  return `${name}|${Math.round(calories ?? 0)}`;
}

function shiftIsoDate(date: IsoDate, deltaDays: number): IsoDate {
  const [year, month, day] = date.split("-").map(Number);
  const local = new Date(year, (month ?? 1) - 1, day ?? 1);
  local.setDate(local.getDate() + deltaDays);
  return toLocalIsoDate(local);
}

/** Yesterday relative to a diary view date. */
export function previousIsoDate(date: IsoDate): IsoDate {
  return shiftIsoDate(date, -1);
}

function toTemplate(entry: FoodEntry): QuickAddFood {
  return {
    name: entry.description,
    calories: entry.macros.calories ?? 0,
    macros: { ...entry.macros },
    lastMeal: entry.mealType
  };
}

/** Newest first: by date, then by recordedAt within a date. */
function newestFirst(a: FoodEntry, b: FoodEntry): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.recordedAt < b.recordedAt ? 1 : b.recordedAt < a.recordedAt ? -1 : 0;
}

/**
 * Unique foods logged in the trailing window, most recent first,
 * excluding anything logged on `today` (those are already in the diary).
 */
export function recentFoods(
  entries: FoodEntry[],
  options: QuickAddWindowOptions = {}
): QuickAddFood[] {
  const { today = toLocalIsoDate(), days = 14, limit = 8 } = options;
  const cutoff = shiftIsoDate(today, -days);

  const candidates = entries
    .filter((entry) => entry.date >= cutoff && entry.date < today)
    .sort(newestFirst);

  const seen = new Set<string>();
  const result: QuickAddFood[] = [];
  for (const entry of candidates) {
    const key = quickAddKey(entry.description, entry.macros.calories);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(toTemplate(entry));
    if (result.length >= limit) break;
  }
  return result;
}

/**
 * Foods logged at least twice in the trailing window, ranked by how often
 * they show up (ties broken by recency). Includes today's entries —
 * frequency is about habit, not novelty.
 */
export function frequentFoods(
  entries: FoodEntry[],
  options: QuickAddWindowOptions = {}
): QuickAddFood[] {
  const { today = toLocalIsoDate(), days = 45, limit = 8 } = options;
  const cutoff = shiftIsoDate(today, -days);

  const windowed = entries
    .filter((entry) => entry.date >= cutoff && entry.date <= today)
    .sort(newestFirst);

  const buckets = new Map<string, { count: number; latest: FoodEntry }>();
  for (const entry of windowed) {
    const key = quickAddKey(entry.description, entry.macros.calories);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count += 1; // `windowed` is newest-first, so the first hit stays latest.
    } else {
      buckets.set(key, { count: 1, latest: entry });
    }
  }

  return Array.from(buckets.values())
    .filter((bucket) => bucket.count >= 2)
    .sort((a, b) => b.count - a.count || newestFirst(a.latest, b.latest))
    .slice(0, limit)
    .map((bucket) => toTemplate(bucket.latest));
}

export type QuickAddSuggestions = {
  recent: QuickAddFood[];
  /** Frequent foods, minus anything already covered by `recent`. */
  frequent: QuickAddFood[];
};

/** Both strips at once, deduped against each other for the UI. */
export function buildQuickAddSuggestions(
  entries: FoodEntry[],
  options: Pick<QuickAddWindowOptions, "today"> = {}
): QuickAddSuggestions {
  const recent = recentFoods(entries, options);
  const recentKeys = new Set(recent.map((item) => quickAddKey(item.name, item.calories)));
  const frequent = frequentFoods(entries, options).filter(
    (item) => !recentKeys.has(quickAddKey(item.name, item.calories))
  );
  return { recent, frequent };
}

/**
 * Copy-yesterday: re-log a set of entries onto `targetDate` as brand-new
 * entries (fresh ids and timestamps, same food + macros). Photo refs are
 * intentionally not carried over — the photo belongs to the original meal.
 */
export function copyEntriesToDate(
  entries: FoodEntry[],
  targetDate: IsoDate,
  now: IsoDateTime = new Date().toISOString()
): FoodEntry[] {
  return entries.map((entry) =>
    createFoodEntry(
      {
        date: targetDate,
        mealType: entry.mealType,
        description: entry.description,
        macros: { ...entry.macros },
        estimateSource: entry.estimateSource,
        confidence: entry.confidence
      },
      now
    )
  );
}
