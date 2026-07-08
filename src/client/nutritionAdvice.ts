/**
 * Resolves TODAY's nutrition advice ("what should I eat now?") from the diary
 * and the daily target.
 *
 * Pipeline: deterministic rules engine (buildNutritionAdvice) → optional AI
 * rewrite in a personal coach tone (clamped to the deterministic numbers) →
 * cached per day + diary-state signature, so advice refreshes when the diary
 * meaningfully changes but never re-hits the paid API per keystroke. Falls back
 * to the deterministic advice whenever the AI is unavailable.
 */

import { getAuthHeaders } from "@/client/authToken";
import { getTargetForDate } from "@/data/dailyNutritionTargetRepository";
import { createLocalFoodEntryRepository } from "@/data/foodEntryRepository";
import { createLocalMemoryRepository } from "@/data/memoryRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalWorkoutRepository } from "@/data/workoutRepository";
import { loadWiki } from "@/data/wikiRepository";
import type { DailyNutritionTarget } from "@/domain/dailyNutritionTarget";
import { toLocalIsoDate } from "@/domain/dates";
import { formatMemoriesForPrompt, memoryCategoryOf } from "@/domain/memory";
import { getLatestMetricEntry } from "@/domain/metrics";
import { getFoodEntriesForDate, sumMacros } from "@/domain/nutrition";
import {
  buildNutritionAdvice,
  isNutritionAdvice,
  type NutritionAdvice
} from "@/domain/nutritionAdvice";
import { formatWikiForPrompt, isWikiEmpty } from "@/domain/personalWiki";
import type { FoodEntry, IsoDate } from "@/domain";

const CACHE_KEY = "lifequest.dailyNutritionAdvice.v1";

type CachedAdvice = { signature: string; advice: NutritionAdvice };

function daysBetween(earlier: IsoDate, later: IsoDate): number {
  const a = Date.parse(`${earlier}T00:00:00`);
  const b = Date.parse(`${later}T00:00:00`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/**
 * The diary-state fingerprint the cache is keyed on. Includes the date, entry
 * count, calorie/protein totals, and the target's identity — so adding a food
 * or recomputing the target refreshes the advice, while re-renders don't.
 */
export function buildAdviceSignature(
  date: IsoDate,
  target: DailyNutritionTarget | null,
  entriesToday: FoodEntry[]
): string {
  const totals = sumMacros(entriesToday);
  return [
    date,
    entriesToday.length,
    Math.round(totals.calories),
    Math.round(totals.proteinG),
    target ? `${target.calorieTarget}:${target.proteinTargetG}:${target.source}` : "no-target"
  ].join("|");
}

function readCache(storage: Storage): CachedAdvice | null {
  let raw: string | null;
  try {
    raw = storage.getItem(CACHE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const cached = parsed as Partial<CachedAdvice>;
    if (typeof cached.signature !== "string" || !isNutritionAdvice(cached.advice)) return null;
    return { signature: cached.signature, advice: cached.advice };
  } catch {
    return null;
  }
}

// Written directly (not via createLocalRepository) so saving advice does NOT
// dispatch the data-changed event — the diary reloads on that event, and a
// cache write must never trigger the recompute that produced it.
function writeCache(storage: Storage, cached: CachedAdvice): void {
  try {
    storage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Cache-only data — losing it just means one extra recompute.
  }
}

function weightDelta7d(storage: Storage, date: IsoDate): number | undefined {
  const metrics = createLocalMetricRepository(storage).load();
  const current = getLatestMetricEntry(metrics)?.weightLbs;
  if (typeof current !== "number") return undefined;
  const weights = metrics
    .filter((m) => typeof m.weightLbs === "number")
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const weekAgo = weights.find((m) => daysBetween(m.date, date) >= 7);
  if (!weekAgo?.weightLbs) return undefined;
  return Math.round((current - weekAgo.weightLbs) * 10) / 10;
}

function trainedToday(storage: Storage, date: IsoDate): boolean {
  return createLocalWorkoutRepository(storage)
    .load()
    .some((w) => w.date === date);
}

/**
 * The rules-engine advice for today — synchronous, so the UI can render it
 * immediately while the AI rewrite (if any) loads.
 */
export function buildDeterministicAdvice(
  storage: Storage,
  date: IsoDate,
  target: DailyNutritionTarget | null,
  now: Date = new Date()
): NutritionAdvice {
  const entriesToday = getFoodEntriesForDate(
    createLocalFoodEntryRepository(storage).load(),
    date
  );
  return buildNutritionAdvice({
    date,
    now: now.toISOString(),
    target,
    entriesToday,
    nowMinutes: now.getHours() * 60 + now.getMinutes(),
    weightDelta7d: weightDelta7d(storage, date),
    trainedToday: trainedToday(storage, date)
  });
}

function buildDiarySummary(entriesToday: FoodEntry[]): string | undefined {
  if (entriesToday.length === 0) return undefined;
  const lines = entriesToday.slice(0, 20).map((entry) => {
    const parts = [
      entry.macros.calories !== undefined ? `${Math.round(entry.macros.calories)} kcal` : null,
      entry.macros.proteinG !== undefined ? `${Math.round(entry.macros.proteinG)}g protein` : null
    ].filter(Boolean);
    return `- ${entry.mealType}: ${entry.description}${parts.length ? ` (${parts.join(", ")})` : ""}`;
  });
  const totals = sumMacros(entriesToday);
  lines.push(
    `Totals: ${Math.round(totals.calories)} kcal, ${Math.round(totals.proteinG)}g protein, ` +
      `${Math.round(totals.carbsG)}g carbs, ${Math.round(totals.fatG)}g fat, ${Math.round(totals.fiberG)}g fiber.`
  );
  return lines.join("\n");
}

function buildMemoryContext(storage: Storage): string | undefined {
  const nutritionMemories = createLocalMemoryRepository(storage)
    .load()
    .filter((entry) => memoryCategoryOf(entry) === "nutrition");
  if (nutritionMemories.length === 0) return undefined;
  return formatMemoriesForPrompt(nutritionMemories, 1_500);
}

// Module-level guard so React StrictMode's double-invoked effect (and any
// concurrent callers) share one compute per diary state instead of racing
// duplicate paid AI calls. Same pattern as nutritionTarget.
let inFlightAdvice: { signature: string; promise: Promise<NutritionAdvice> } | null = null;

/**
 * Today's advice — cached per (day + diary state), else computed (AI-toned
 * when available, deterministic otherwise). Pass the already-resolved daily
 * target when you have it to avoid a redundant repository read.
 */
export async function getOrComputeDailyAdvice(
  storage: Storage = window.localStorage,
  target?: DailyNutritionTarget | null
): Promise<NutritionAdvice> {
  const date = toLocalIsoDate();
  const resolvedTarget = target !== undefined ? target : (getTargetForDate(storage, date) ?? null);
  const entriesToday = getFoodEntriesForDate(createLocalFoodEntryRepository(storage).load(), date);
  const signature = buildAdviceSignature(date, resolvedTarget, entriesToday);

  const cached = readCache(storage);
  if (cached && cached.signature === signature && cached.advice.date === date) {
    return cached.advice;
  }

  if (inFlightAdvice?.signature === signature) return inFlightAdvice.promise;
  const promise = computeDailyAdvice(storage, date, resolvedTarget, entriesToday, signature).finally(
    () => {
      if (inFlightAdvice?.promise === promise) inFlightAdvice = null;
    }
  );
  inFlightAdvice = { signature, promise };
  return promise;
}

async function computeDailyAdvice(
  storage: Storage,
  date: IsoDate,
  target: DailyNutritionTarget | null,
  entriesToday: FoodEntry[],
  signature: string
): Promise<NutritionAdvice> {
  const deterministic = buildDeterministicAdvice(storage, date, target);

  // Without a target there's only the "finish your profile" pointer — not
  // worth a paid AI call, and nothing for the AI to personalize.
  let advice = deterministic;
  if (target) {
    try {
      const wiki = loadWiki(storage);
      const response = await fetch("/api/ai/nutrition-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({
          date,
          deterministic,
          diarySummary: buildDiarySummary(entriesToday),
          profileContext: isWikiEmpty(wiki) ? undefined : formatWikiForPrompt(wiki, 2_000),
          memoryContext: buildMemoryContext(storage)
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (isNutritionAdvice(data) && data.date === date) advice = data;
      }
    } catch {
      // Network/AI down — keep the deterministic advice.
    }
  }

  writeCache(storage, { signature, advice });
  return advice;
}

/** Exposed for tests/debugging: drop the cached advice so the next call recomputes. */
export function clearAdviceCache(storage: Storage = window.localStorage): void {
  try {
    storage.removeItem(CACHE_KEY);
  } catch {
    // Ignore — cache only.
  }
}

export const nutritionAdviceCacheKey = CACHE_KEY;
