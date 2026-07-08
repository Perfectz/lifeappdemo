/**
 * Week in Review — Noom-style weekly coaching, computed deterministically.
 *
 * `buildWeeklyReview` is a pure aggregation over one Monday-to-Sunday week of
 * workouts, metrics, food entries, nutrition targets, and quests. It produces
 * the numbers, deterministic highlights (PRs first, then streak/adherence/
 * weight milestones), and rule-based focus suggestions. An AI may rewrite the
 * story in a coach tone, but `clampWeeklyReviewFromAI` guarantees wins/focus
 * are only rephrasings of the deterministic ground truth — the AI can reword,
 * never invent.
 */

import { toLocalIsoDate } from "@/domain/dates";
import { sumMacros } from "@/domain/nutrition";
import { detectNewRecords, type PersonalRecord } from "@/domain/personalRecords";
import { epleyE1Rm, normalizeExerciseName } from "@/domain/strengthProgression";
import type { DailyNutritionTarget } from "@/domain/dailyNutritionTarget";
import type {
  FoodEntry,
  IsoDate,
  IsoDateTime,
  MetricEntry,
  Task,
  Workout,
  WorkoutType
} from "@/domain/types";

/* ------------------------------------------------------------- week math -- */

function parseIso(date: IsoDate): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function addDaysIso(date: IsoDate, days: number): IsoDate {
  const d = parseIso(date);
  d.setDate(d.getDate() + days);
  return toLocalIsoDate(d);
}

/** Monday of the week containing `date`. */
export function weekStartOf(date: IsoDate): IsoDate {
  const d = parseIso(date);
  // getDay(): Sun=0 … Sat=6. Monday-based offset: Sun → 6 back, Mon → 0.
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return toLocalIsoDate(d);
}

function daysBetweenIso(earlier: IsoDate, later: IsoDate): number {
  const ms = parseIso(later).getTime() - parseIso(earlier).getTime();
  return Math.round(ms / 86_400_000);
}

/* ----------------------------------------------------------------- types -- */

export type WeeklyBestLift = {
  exercise: string;
  /** Best Epley e1RM (lb, rounded) inside the week. */
  e1Rm: number;
  weightLbs: number;
  reps: number;
};

export type WeeklyReview = {
  range: { start: IsoDate; end: IsoDate };
  /** True when the week has no workouts, food, metrics, or quests at all. */
  emptyWeek: boolean;
  training: {
    sessionsByType: Record<WorkoutType, number>;
    totalSessions: number;
    /** Days elapsed in the week × 3, capped at 21 — partial weeks aren't judged on 7 days. */
    targetSessions: number;
    /** Top 3 lifts by e1RM inside the week. */
    bestLifts: WeeklyBestLift[];
    /** PR summaries earned this week, judged against pre-week history. */
    newPRs: string[];
    kettlebellSwings: number;
    karateClasses: number;
  };
  nutrition: {
    daysLogged: number;
    /** Mean daily kcal across logged days; null when nothing was logged. */
    avgCalories: number | null;
    avgProtein: number | null;
    /** % of logged days within ±10% of that day's calorie target (target days only). */
    adherencePct: number | null;
    /** Omitted entirely when there is no water data. */
    waterNote?: string;
  };
  body: {
    weightStartLbs: number | null;
    weightEndLbs: number | null;
    /** End − start using the in-range entries nearest each bound; null with <2 entries. */
    weightDeltaLbs: number | null;
    avgSleepHours: number | null;
    avgEnergy: number | null;
  };
  quests: { completed: number; planned: number };
  /** Deterministic, ordered: PRs first, then streak/adherence/weight milestones. */
  highlights: string[];
  /** Deterministic rules: training balance, protein, sleep, vitals gaps. */
  focusSuggestions: string[];
};

export type WeeklyReviewInput = {
  /** Monday ISO date. Any other day is snapped back to its Monday. */
  weekStart: IsoDate;
  workouts: Workout[];
  metrics: MetricEntry[];
  foodEntries: FoodEntry[];
  targets: DailyNutritionTarget[];
  tasks: Task[];
  /** "Today" for partial-week session targets. Defaults to the week's end. */
  today?: IsoDate;
  /** Optional water intake per date (any unit); absent → no waterNote. */
  waterByDate?: Partial<Record<IsoDate, number>>;
};

const SESSIONS_PER_DAY = 3;
const MAX_TARGET_SESSIONS = 21;
/** Adherence: a logged day counts when within ±10% of its calorie target. */
export const ADHERENCE_BAND = 0.1;
/** Highlights call out adherence at or above this. */
export const ADHERENCE_HIGHLIGHT_PCT = 80;
/** Focus flags sleep below this nightly average. */
export const SLEEP_TARGET_HOURS = 7;
/** Focus flags protein averaging below this share of the target. */
export const PROTEIN_FOCUS_RATIO = 0.9;

const TYPE_LABEL: Record<WorkoutType, string> = {
  strength: "strength",
  cardio: "cardio",
  martial_arts: "martial arts"
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((total, v) => total + v, 0) / values.length;
}

function inRange(date: IsoDate, start: IsoDate, end: IsoDate): boolean {
  return date >= start && date <= end;
}

/** Local calendar date of an ISO timestamp (falls back to the date prefix). */
function localDateOf(timestamp: IsoDateTime): IsoDate {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return timestamp.slice(0, 10);
  return toLocalIsoDate(parsed);
}

function sortChronologically(workouts: Workout[]): Workout[] {
  return [...workouts].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return (a.recordedAt ?? "") < (b.recordedAt ?? "") ? -1 : 1;
  });
}

/* ------------------------------------------------------------ aggregation -- */

function collectBestLifts(weekWorkouts: Workout[]): WeeklyBestLift[] {
  const best = new Map<string, WeeklyBestLift>();
  for (const workout of weekWorkouts) {
    if (workout.type !== "strength" || !Array.isArray(workout.sets)) continue;
    for (const set of workout.sets) {
      if (typeof set.weightLbs !== "number" || !Number.isFinite(set.weightLbs) || set.weightLbs <= 0) {
        continue;
      }
      const key = normalizeExerciseName(set.exercise);
      if (!key) continue;
      const reps = typeof set.reps === "number" && set.reps > 0 ? set.reps : 1;
      const e1Rm = epleyE1Rm(set.weightLbs, reps);
      const current = best.get(key);
      if (!current || e1Rm > current.e1Rm) {
        best.set(key, {
          exercise: set.exercise.replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim(),
          e1Rm,
          weightLbs: set.weightLbs,
          reps
        });
      }
    }
  }
  return [...best.values()]
    .sort((a, b) => b.e1Rm - a.e1Rm)
    .slice(0, 3)
    .map((lift) => ({ ...lift, e1Rm: Math.round(lift.e1Rm) }));
}

/**
 * PRs earned this week, judged against everything logged BEFORE the week plus
 * earlier in-week sessions — a lift only counts as a PR if it beats pre-week
 * history (or an earlier PR set this same week), never sessions after it.
 */
function collectNewPRs(preWeek: Workout[], weekWorkouts: Workout[]): string[] {
  const history = [...preWeek];
  const best = new Map<string, PersonalRecord>();
  for (const workout of sortChronologically(weekWorkouts)) {
    for (const record of detectNewRecords(history, workout)) {
      const key = `${normalizeExerciseName(record.exercise)}|${record.kind}`;
      const current = best.get(key);
      if (!current || record.value > current.value) best.set(key, record);
    }
    history.push(workout);
  }
  return [...best.values()]
    .sort((a, b) => b.value - a.value)
    .map((record) => record.summary);
}

/* ----------------------------------------------------------------- build -- */

export function buildWeeklyReview(input: WeeklyReviewInput): WeeklyReview {
  const start = weekStartOf(input.weekStart);
  const end = addDaysIso(start, 6);

  // Partial weeks aren't judged against 21 sessions — only elapsed days count.
  const today = input.today ?? end;
  const elapsed = Math.min(7, Math.max(1, daysBetweenIso(start, today < end ? today : end) + 1));
  const targetSessions = Math.min(elapsed * SESSIONS_PER_DAY, MAX_TARGET_SESSIONS);

  const weekWorkouts = input.workouts.filter((w) => inRange(w.date, start, end));
  const preWeekWorkouts = input.workouts.filter((w) => w.date < start);
  const weekMetrics = input.metrics.filter((m) => inRange(m.date, start, end));
  const weekFood = input.foodEntries.filter((f) => inRange(f.date, start, end));

  /* -- training -- */
  const sessionsByType: Record<WorkoutType, number> = { strength: 0, cardio: 0, martial_arts: 0 };
  for (const workout of weekWorkouts) sessionsByType[workout.type] += 1;
  const totalSessions = weekWorkouts.length;

  const bestLifts = collectBestLifts(weekWorkouts);
  const newPRs = collectNewPRs(preWeekWorkouts, weekWorkouts);

  const swingsFromMetrics = weekMetrics.reduce(
    (total, m) => total + (typeof m.kettlebellSwingsTotal === "number" ? m.kettlebellSwingsTotal : 0),
    0
  );
  const swingsFromSets = weekWorkouts.reduce((total, workout) => {
    if (workout.type !== "strength" || !Array.isArray(workout.sets)) return total;
    return (
      total +
      workout.sets.reduce(
        (sum, set) =>
          normalizeExerciseName(set.exercise).includes("swing") && typeof set.reps === "number"
            ? sum + set.reps
            : sum,
        0
      )
    );
  }, 0);
  // Metrics are the primary swing tally; set reps only fill in when no metric entry logged them.
  const kettlebellSwings = swingsFromMetrics > 0 ? swingsFromMetrics : swingsFromSets;

  const karateClasses = new Set(
    weekMetrics.filter((m) => m.karateClass === true).map((m) => m.date)
  ).size;

  /* -- nutrition -- */
  const caloriesByDate = new Map<IsoDate, number>();
  const proteinByDate = new Map<IsoDate, number>();
  for (const date of new Set(weekFood.map((f) => f.date))) {
    const totals = sumMacros(weekFood.filter((f) => f.date === date));
    caloriesByDate.set(date, totals.calories);
    proteinByDate.set(date, totals.proteinG);
  }
  const daysLogged = caloriesByDate.size;
  const avgCaloriesRaw = mean([...caloriesByDate.values()]);
  const avgProteinRaw = mean([...proteinByDate.values()]);
  const avgCalories = avgCaloriesRaw === null ? null : Math.round(avgCaloriesRaw);
  const avgProtein = avgProteinRaw === null ? null : Math.round(avgProteinRaw);

  const targetByDate = new Map(input.targets.map((t) => [t.date, t]));
  let adherenceDenominator = 0;
  let adherenceHits = 0;
  for (const [date, calories] of caloriesByDate) {
    const target = targetByDate.get(date);
    if (!target || !(target.calorieTarget > 0)) continue;
    adherenceDenominator += 1;
    if (Math.abs(calories - target.calorieTarget) <= target.calorieTarget * ADHERENCE_BAND) {
      adherenceHits += 1;
    }
  }
  const adherencePct =
    adherenceDenominator > 0 ? Math.round((adherenceHits / adherenceDenominator) * 100) : null;

  const waterDays = Object.entries(input.waterByDate ?? {}).filter(
    ([date, amount]) => inRange(date, start, end) && typeof amount === "number" && amount > 0
  );
  const waterNote =
    waterDays.length > 0 ? `Water logged on ${waterDays.length} of 7 days.` : undefined;

  /* -- body -- */
  const weightEntries = weekMetrics
    .filter((m) => typeof m.weightLbs === "number" && Number.isFinite(m.weightLbs))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.recordedAt < b.recordedAt ? -1 : 1;
    });
  const weightStartLbs = weightEntries[0]?.weightLbs ?? null;
  const weightEndLbs = weightEntries[weightEntries.length - 1]?.weightLbs ?? null;
  const weightDeltaLbs =
    weightEntries.length >= 2 && weightStartLbs !== null && weightEndLbs !== null
      ? round1(weightEndLbs - weightStartLbs)
      : null;

  const sleepValues = weekMetrics
    .map((m) => m.sleepHours)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const energyValues = weekMetrics
    .map((m) => m.energyLevel as number | undefined)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const avgSleepRaw = mean(sleepValues);
  const avgEnergyRaw = mean(energyValues);
  const avgSleepHours = avgSleepRaw === null ? null : round1(avgSleepRaw);
  const avgEnergy = avgEnergyRaw === null ? null : round1(avgEnergyRaw);

  /* -- quests -- */
  const planned = input.tasks.filter(
    (task) => task.plannedForDate !== undefined && inRange(task.plannedForDate, start, end)
  ).length;
  const completed = input.tasks.filter(
    (task) => task.completedAt !== undefined && inRange(localDateOf(task.completedAt), start, end)
  ).length;

  const emptyWeek =
    totalSessions === 0 &&
    weekMetrics.length === 0 &&
    weekFood.length === 0 &&
    planned === 0 &&
    completed === 0;

  /* -- highlights: PRs first, then streak/adherence/weight milestones -- */
  const highlights: string[] = [];
  if (!emptyWeek) {
    highlights.push(...newPRs.slice(0, 3));
    if (totalSessions > 0 && totalSessions >= targetSessions) {
      highlights.push(`Hit the training target — ${totalSessions} of ${targetSessions} sessions.`);
    }
    if (daysLogged >= 5) {
      highlights.push(`Food logged ${daysLogged} of 7 days — a real tracking streak.`);
    }
    if (adherencePct !== null && adherencePct >= ADHERENCE_HIGHLIGHT_PCT) {
      highlights.push(`Calorie adherence ${adherencePct}% on logged days.`);
    }
    if (weightDeltaLbs !== null && weightDeltaLbs <= -1) {
      highlights.push(`Weight down ${Math.abs(weightDeltaLbs)} lb across the week.`);
    }
  }

  /* -- focus suggestions: deterministic rules -- */
  const focusSuggestions: string[] = [];
  if (!emptyWeek) {
    if (totalSessions === 0) {
      focusSuggestions.push("No training logged this week — get one session in to restart momentum.");
    } else {
      const types = Object.entries(sessionsByType) as [WorkoutType, number][];
      const lowest = types.reduce((min, entry) => (entry[1] < min[1] ? entry : min));
      const highest = types.reduce((max, entry) => (entry[1] > max[1] ? entry : max));
      if (lowest[1] === 0) {
        focusSuggestions.push(`No ${TYPE_LABEL[lowest[0]]} this week — schedule one session.`);
      } else if (lowest[1] < highest[1]) {
        focusSuggestions.push(
          `Only ${lowest[1]} ${TYPE_LABEL[lowest[0]]} session${lowest[1] === 1 ? "" : "s"} — balance the split.`
        );
      }
    }

    const loggedTargets = [...caloriesByDate.keys()]
      .map((date) => targetByDate.get(date))
      .filter((t): t is DailyNutritionTarget => t !== undefined && t.proteinTargetG > 0);
    const avgProteinTarget = mean(loggedTargets.map((t) => t.proteinTargetG));
    if (
      avgProtein !== null &&
      avgProteinTarget !== null &&
      avgProtein < avgProteinTarget * PROTEIN_FOCUS_RATIO
    ) {
      focusSuggestions.push(
        `Protein averaged ${avgProtein}g vs a ~${Math.round(avgProteinTarget)}g target — lead each meal with protein.`
      );
    }

    if (avgSleepHours !== null && avgSleepHours < SLEEP_TARGET_HOURS) {
      focusSuggestions.push(
        `Sleep averaged ${avgSleepHours}h — protect a ${SLEEP_TARGET_HOURS}+ hour window.`
      );
    }

    const hasBP = weekMetrics.some(
      (m) => typeof m.bloodPressureSystolic === "number" && typeof m.bloodPressureDiastolic === "number"
    );
    if (!hasBP) {
      focusSuggestions.push("No blood-pressure reading this week — log one to keep vitals current.");
    }
    if (weightEntries.length === 0) {
      focusSuggestions.push("No weigh-in this week — step on the scale to keep the trend honest.");
    }
  }

  const review: WeeklyReview = {
    range: { start, end },
    emptyWeek,
    training: {
      sessionsByType,
      totalSessions,
      targetSessions,
      bestLifts,
      newPRs,
      kettlebellSwings,
      karateClasses
    },
    nutrition: { daysLogged, avgCalories, avgProtein, adherencePct },
    body: { weightStartLbs, weightEndLbs, weightDeltaLbs, avgSleepHours, avgEnergy },
    quests: { completed, planned },
    highlights: highlights.slice(0, 5),
    focusSuggestions: focusSuggestions.slice(0, 4)
  };
  if (waterNote) review.nutrition.waterNote = waterNote;
  return review;
}

/* ------------------------------------------------- narrative + AI clamps -- */

export const weeklyNarrativeSources = ["deterministic", "ai"] as const;
export type WeeklyNarrativeSource = (typeof weeklyNarrativeSources)[number];

export type WeeklyReviewNarrative = {
  weekStart: IsoDate;
  /** 3-5 sentence coach-toned story of the week. */
  narrative: string;
  /** Up to 3 wins — always rephrasings of the deterministic highlights. */
  wins: string[];
  /** Up to 3 focus points — rephrasings of the deterministic focusSuggestions. */
  focus: string[];
  source: WeeklyNarrativeSource;
  createdAt: IsoDateTime;
};

/** The rules-engine narrative — what the AI is allowed to reword. */
export function buildDeterministicWeeklyNarrative(
  review: WeeklyReview,
  now: IsoDateTime = new Date().toISOString()
): WeeklyReviewNarrative {
  const weekStart = review.range.start;
  if (review.emptyWeek) {
    return {
      weekStart,
      narrative:
        "Nothing logged this week yet — no workouts, meals, or check-ins. Log a session or a meal and the weekly story writes itself.",
      wins: [],
      focus: [],
      source: "deterministic",
      createdAt: now
    };
  }

  const { training, nutrition, body, quests } = review;
  const sentences: string[] = [];
  sentences.push(
    `You trained ${training.totalSessions} time${training.totalSessions === 1 ? "" : "s"} against a target of ${training.targetSessions} (${training.sessionsByType.strength} strength, ${training.sessionsByType.cardio} cardio, ${training.sessionsByType.martial_arts} martial arts).`
  );
  if (training.newPRs.length > 0) {
    sentences.push(
      `${training.newPRs.length} new personal record${training.newPRs.length === 1 ? "" : "s"} went in the books.`
    );
  }
  if (nutrition.daysLogged > 0) {
    const adherence = nutrition.adherencePct !== null ? ` with ${nutrition.adherencePct}% calorie adherence` : "";
    sentences.push(
      `Food was logged ${nutrition.daysLogged} of 7 days, averaging ${nutrition.avgCalories} kcal and ${nutrition.avgProtein}g protein${adherence}.`
    );
  } else {
    sentences.push("No food was logged this week, so nutrition coaching is flying blind.");
  }
  if (body.weightDeltaLbs !== null) {
    const direction = body.weightDeltaLbs < 0 ? "down" : body.weightDeltaLbs > 0 ? "up" : "flat at";
    sentences.push(
      body.weightDeltaLbs === 0
        ? `Weight held flat at ${body.weightEndLbs} lb.`
        : `Weight ended ${direction} ${Math.abs(body.weightDeltaLbs)} lb at ${body.weightEndLbs} lb.`
    );
  }
  if (quests.planned > 0 || quests.completed > 0) {
    sentences.push(`Quests: ${quests.completed} completed of ${quests.planned} planned.`);
  }

  return {
    weekStart,
    narrative: sentences.slice(0, 5).join(" "),
    wins: review.highlights.slice(0, 3),
    focus: review.focusSuggestions.slice(0, 3),
    source: "deterministic",
    createdAt: now
  };
}

const MAX_NARRATIVE_CHARS = 900;
const MAX_LINE_CHARS = 200;

function cleanText(value: unknown, fallback: string, max: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, max) : fallback;
}

/**
 * Clamp an AI rewrite to the deterministic ground truth: the narrative may be
 * reworded (length-capped), and wins/focus are strictly index-wise rephrasings
 * of the deterministic lists — the AI can never add, reorder, or invent items.
 */
export function clampWeeklyReviewFromAI(
  value: unknown,
  deterministic: WeeklyReviewNarrative,
  now: IsoDateTime = new Date().toISOString()
): WeeklyReviewNarrative {
  const r = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;

  const rawWins = Array.isArray(r.wins) ? (r.wins as unknown[]) : [];
  const rawFocus = Array.isArray(r.focus) ? (r.focus as unknown[]) : [];

  return {
    weekStart: deterministic.weekStart,
    narrative: cleanText(r.narrative, deterministic.narrative, MAX_NARRATIVE_CHARS),
    wins: deterministic.wins.map((win, index) => cleanText(rawWins[index], win, MAX_LINE_CHARS)),
    focus: deterministic.focus.map((item, index) => cleanText(rawFocus[index], item, MAX_LINE_CHARS)),
    source: "ai",
    createdAt: now
  };
}

/* ---------------------------------------------------------------- guards -- */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

export function isWeeklyReviewNarrative(value: unknown): value is WeeklyReviewNarrative {
  if (!value || typeof value !== "object") return false;
  const n = value as Partial<WeeklyReviewNarrative>;
  return (
    typeof n.weekStart === "string" &&
    ISO_DATE_RE.test(n.weekStart) &&
    typeof n.narrative === "string" &&
    n.narrative.trim().length > 0 &&
    isStringArray(n.wins) &&
    n.wins.length <= 3 &&
    isStringArray(n.focus) &&
    n.focus.length <= 3 &&
    weeklyNarrativeSources.includes(n.source as WeeklyNarrativeSource) &&
    typeof n.createdAt === "string"
  );
}

export function isWeeklyReview(value: unknown): value is WeeklyReview {
  if (!value || typeof value !== "object") return false;
  const r = value as Partial<WeeklyReview>;
  if (!r.range || typeof r.range !== "object") return false;
  if (!ISO_DATE_RE.test(String(r.range.start)) || !ISO_DATE_RE.test(String(r.range.end))) return false;
  if (typeof r.emptyWeek !== "boolean") return false;

  const t = r.training;
  if (
    !t ||
    typeof t !== "object" ||
    !t.sessionsByType ||
    typeof t.sessionsByType.strength !== "number" ||
    typeof t.sessionsByType.cardio !== "number" ||
    typeof t.sessionsByType.martial_arts !== "number" ||
    typeof t.totalSessions !== "number" ||
    typeof t.targetSessions !== "number" ||
    !Array.isArray(t.bestLifts) ||
    !isStringArray(t.newPRs) ||
    typeof t.kettlebellSwings !== "number" ||
    typeof t.karateClasses !== "number"
  ) {
    return false;
  }

  const n = r.nutrition;
  if (
    !n ||
    typeof n !== "object" ||
    typeof n.daysLogged !== "number" ||
    !isNumberOrNull(n.avgCalories) ||
    !isNumberOrNull(n.avgProtein) ||
    !isNumberOrNull(n.adherencePct)
  ) {
    return false;
  }

  const b = r.body;
  if (
    !b ||
    typeof b !== "object" ||
    !isNumberOrNull(b.weightStartLbs) ||
    !isNumberOrNull(b.weightEndLbs) ||
    !isNumberOrNull(b.weightDeltaLbs) ||
    !isNumberOrNull(b.avgSleepHours) ||
    !isNumberOrNull(b.avgEnergy)
  ) {
    return false;
  }

  const q = r.quests;
  if (!q || typeof q !== "object" || typeof q.completed !== "number" || typeof q.planned !== "number") {
    return false;
  }

  return isStringArray(r.highlights) && isStringArray(r.focusSuggestions);
}
