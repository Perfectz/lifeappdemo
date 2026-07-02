/**
 * Resolves "Today's Workout" plan: deterministic rotation baseline → AI plan
 * (presets or custom, injury/equipment/readiness-aware via coaching memory) →
 * cached once per day. Falls back to the deterministic plan whenever the AI is
 * unavailable, so there's always a session waiting with zero decisions.
 */

import { equipmentForVariant, getExerciseVariant, strengthWorkouts } from "@/config/fitness";
import { loadHealthGoals } from "@/data/healthGoalsRepository";
import { createLocalMemoryRepository } from "@/data/memoryRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalWorkoutRepository } from "@/data/workoutRepository";
import {
  clearWorkoutPlanForDate,
  getWorkoutPlanForDate,
  upsertWorkoutPlan
} from "@/data/dailyWorkoutPlanRepository";
import { toLocalIsoDate } from "@/domain/dates";
import { getLatestMetricEntry } from "@/domain/metrics";
import {
  formatMemoriesForPrompt,
  memoryCategoryOf,
  type MemoryCategory
} from "@/domain/memory";
import {
  buildDeterministicPlan,
  buildWorkoutCatalog,
  isDailyWorkoutPlan,
  type DailyWorkoutPlan,
  type WorkoutSuggestion
} from "@/domain/workoutPlan";
import type { WorkoutInput } from "@/domain/workouts";
import type { IsoDate, Workout, WorkoutType } from "@/domain";

const TRAINING_RELEVANT: MemoryCategory[] = [
  "injury",
  "condition",
  "equipment",
  "schedule",
  "training"
];

function recentWorkouts(storage: Storage, days: number): Workout[] {
  const today = Date.parse(`${toLocalIsoDate()}T00:00:00`);
  return createLocalWorkoutRepository(storage)
    .load()
    .filter((w) => {
      const t = Date.parse(`${w.date}T00:00:00`);
      return !Number.isNaN(t) && (today - t) / 86_400_000 < days && t <= today;
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

function historySummary(workouts: Workout[]): string {
  if (workouts.length === 0) return "No workouts logged recently.";
  return workouts
    .slice(0, 12)
    .map((w) => `${w.date}: ${w.type} — ${w.title ?? "session"}`)
    .join("\n");
}

const LEVEL_WORD: Record<number, string> = {
  1: "very low",
  2: "low",
  3: "ok",
  4: "good",
  5: "great"
};

function readinessSummary(storage: Storage): string | undefined {
  const latest = getLatestMetricEntry(createLocalMetricRepository(storage).load());
  if (!latest) return undefined;
  const parts: string[] = [];
  if (latest.sleepHours) parts.push(`sleep ${latest.sleepHours}h`);
  if (latest.energyLevel) parts.push(`energy ${LEVEL_WORD[latest.energyLevel] ?? latest.energyLevel}`);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function memorySummary(storage: Storage): string | undefined {
  const relevant = createLocalMemoryRepository(storage)
    .load()
    .filter((m) => TRAINING_RELEVANT.includes(memoryCategoryOf(m)));
  const text = formatMemoriesForPrompt(relevant);
  return text || undefined;
}

function goalText(storage: Storage): string {
  const health = loadHealthGoals(storage);
  const weight = getLatestMetricEntry(createLocalMetricRepository(storage).load())?.weightLbs;
  const losing = health.weightTargetLbs && weight && health.weightTargetLbs < weight;
  return losing ? "lose fat while preserving muscle" : "maintain and build capability";
}

export type WorkoutContext = {
  historySummary: string;
  memorySummary?: string;
  readiness?: string;
  goal: string;
  recentStrengthTitles: string[];
};

export function buildWorkoutContext(storage: Storage): WorkoutContext {
  const recent = recentWorkouts(storage, 10);
  return {
    historySummary: historySummary(recent),
    memorySummary: memorySummary(storage),
    readiness: readinessSummary(storage),
    goal: goalText(storage),
    recentStrengthTitles: recent.filter((w) => w.type === "strength").map((w) => w.title ?? "")
  };
}

// Module-level guard so React StrictMode's double-invoked effect (and any
// concurrent callers) share one compute per day instead of racing duplicate
// paid AI calls. Same pattern as timelineSeed.
let inFlightPlan: { date: IsoDate; promise: Promise<DailyWorkoutPlan> } | null = null;

/** Today's plan — cached, else deterministic, upgraded by AI when available. */
export async function getOrComputeWorkoutPlan(
  storage: Storage = window.localStorage
): Promise<DailyWorkoutPlan> {
  const date = toLocalIsoDate();
  const existing = getWorkoutPlanForDate(storage, date);
  if (existing) return existing;

  if (inFlightPlan?.date === date) return inFlightPlan.promise;
  const promise = computeWorkoutPlan(storage, date).finally(() => {
    if (inFlightPlan?.promise === promise) inFlightPlan = null;
  });
  inFlightPlan = { date, promise };
  return promise;
}

async function computeWorkoutPlan(
  storage: Storage,
  date: IsoDate
): Promise<DailyWorkoutPlan> {
  const now = new Date().toISOString();
  const ctx = buildWorkoutContext(storage);
  let plan = buildDeterministicPlan(ctx.recentStrengthTitles, date, now);

  try {
    const response = await fetch("/api/ai/workout-suggestion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        historySummary: ctx.historySummary,
        memorySummary: ctx.memorySummary,
        readiness: ctx.readiness,
        goal: ctx.goal
      })
    });
    if (response.ok) {
      const data = await response.json();
      if (isDailyWorkoutPlan(data) && data.items.length > 0) plan = data;
    }
  } catch {
    // keep deterministic plan
  }

  upsertWorkoutPlan(storage, plan);
  return plan;
}

export async function recomputeWorkoutPlan(
  storage: Storage = window.localStorage
): Promise<DailyWorkoutPlan> {
  clearWorkoutPlanForDate(storage, toLocalIsoDate());
  return getOrComputeWorkoutPlan(storage);
}

/** Offline "Swap": rotate to the next preset option for one bucket. */
export function swapBucketPreset(
  storage: Storage,
  plan: DailyWorkoutPlan,
  bucket: WorkoutType
): DailyWorkoutPlan {
  const catalog = buildWorkoutCatalog();
  const options = catalog[bucket];
  if (options.length === 0) return plan;
  const current = plan.items.find((i) => i.bucket === bucket);
  const currentIdx = options.findIndex((o) => o.id === current?.presetId);
  const next = options[(currentIdx + 1) % options.length];

  const swapped: WorkoutSuggestion = {
    bucket,
    kind: "preset",
    presetId: next.id,
    variant: bucket === "strength" ? current?.variant ?? "Free Weight" : undefined,
    title: next.label,
    estMinutes: current?.estMinutes,
    rationale: "Swapped to your next option.",
    swaps: []
  };

  const items = plan.items.some((i) => i.bucket === bucket)
    ? plan.items.map((i) => (i.bucket === bucket ? swapped : i))
    : [...plan.items, swapped];
  const updated: DailyWorkoutPlan = { ...plan, items };
  upsertWorkoutPlan(storage, updated);
  return updated;
}

/** Map a suggestion into a loggable Workout input (one-tap track). */
export function suggestionToWorkoutInput(
  suggestion: WorkoutSuggestion,
  date: IsoDate
): WorkoutInput {
  const base: WorkoutInput = { date, type: suggestion.bucket, source: "ai", title: suggestion.title };

  if (suggestion.bucket === "strength") {
    const variant = suggestion.variant ?? "Free Weight";
    if (suggestion.kind === "preset") {
      const preset = strengthWorkouts.find((w) => w.id === suggestion.presetId);
      if (preset) {
        return {
          ...base,
          title: `Day ${preset.day} — ${preset.name} · ${variant}`,
          equipment: equipmentForVariant(variant),
          sets: preset.exercises.map((exercise) => ({
            exercise: `${getExerciseVariant(exercise, variant).name} (${exercise.scheme})`
          }))
        };
      }
    }
    // custom strength
    return {
      ...base,
      sets: (suggestion.exercises ?? []).map((line) => ({ exercise: line })),
      notes: suggestion.description
    };
  }

  // cardio / martial arts
  return {
    ...base,
    durationMinutes: suggestion.estMinutes,
    notes: suggestion.description ?? ((suggestion.exercises ?? []).join("; ") || undefined)
  };
}
