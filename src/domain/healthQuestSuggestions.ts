import { VITALS_DEADLINE_MIN, WORKOUT_DEADLINES_MIN } from "@/domain/dailyBrief";
import { getDailyFitnessStatus, requiredSessionTypes } from "@/domain/dailyFitness";
import type { DailyNutritionTarget } from "@/domain/dailyNutritionTarget";
import { isIsoTimestampOnDate } from "@/domain/dates";
import { getFoodEntriesForDate, sumMacros } from "@/domain/nutrition";
import { DEFAULT_WATER_GOAL_OZ } from "@/domain/waterTracking";
import type {
  DailyPlan,
  FoodEntry,
  IsoDate,
  MetricEntry,
  Task,
  TaskPriority,
  Workout,
  WorkoutType
} from "@/domain/types";

/**
 * Coach-to-Quest-Log bridge: turn today's health signals (the same ones the
 * daily brief watches) into concrete, acceptable quests. Pure + deterministic —
 * callers feed in repository snapshots and the current clock; accepting a
 * suggestion is just createTask() with the fields below.
 */

/** Suggestions only nag about food/water once the morning is over. */
export const MIDDAY_MIN = 12 * 60;

/** Below this share of the protein target after midday, we nudge. */
export const PROTEIN_NUDGE_RATIO = 0.6;

/** Below half the water goal after midday, we nudge. */
export const WATER_NUDGE_OZ = DEFAULT_WATER_GOAL_OZ / 2;

/** Never show more than this many suggestions at once. */
export const MAX_SUGGESTIONS = 4;

export type HealthQuestSuggestionKey =
  | "vitals"
  | `session-${WorkoutType}`
  | "protein"
  | "water"
  | "plan";

export type HealthQuestSuggestion = {
  key: HealthQuestSuggestionKey;
  title: string;
  reason: string;
  priority: TaskPriority;
  tag: "health";
};

export type HealthQuestSuggestionsInput = {
  today: IsoDate;
  /** Minutes since local midnight (e.g. 7:30am = 450). */
  nowMinutes: number;
  metrics: MetricEntry[];
  workouts: Workout[];
  foodEntries: FoodEntry[];
  /** Today's nutrition target, when one has been computed. */
  target?: DailyNutritionTarget;
  /** Fluid ounces of water logged today. */
  waterOz: number;
  /** Tasks used for dedupe — non-todo entries are ignored defensively. */
  openTasks: Task[];
  dailyPlans: DailyPlan[];
  /** Schedule-aware session types expected today. Defaults to legacy all-three. */
  requiredWorkoutTypes?: WorkoutType[];
};

/** Titles match TodayTrainingCard's fallback session titles. */
const SESSION_TITLE: Record<WorkoutType, string> = {
  strength: "Strength session",
  cardio: "Cardio session",
  martial_arts: "Martial arts session"
};

function formatTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour >= 12 ? "pm" : "am";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return minute === 0
    ? `${displayHour}${period}`
    : `${displayHour}:${String(minute).padStart(2, "0")}${period}`;
}

/** Mirrors dailyBrief's vitals rule: any of glucose / BP / weight today. */
function vitalsLoggedToday(metrics: MetricEntry[], today: IsoDate): boolean {
  return metrics.some(
    (entry) =>
      entry.date === today &&
      (entry.bloodPressureSystolic !== undefined ||
        entry.bloodGlucoseMgDl !== undefined ||
        entry.weightLbs !== undefined)
  );
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

type RankedSuggestion = HealthQuestSuggestion & {
  /** Lower = more urgent. Sort is stable, so ties keep build order. */
  rank: number;
};

export function buildHealthQuestSuggestions(
  input: HealthQuestSuggestionsInput
): HealthQuestSuggestion[] {
  const { today, nowMinutes, metrics, workouts, foodEntries, target, waterOz, dailyPlans } = input;
  const candidates: RankedSuggestion[] = [];

  // --- Morning vitals (only once the 7:30 deadline has passed) -------------
  if (!vitalsLoggedToday(metrics, today) && nowMinutes > VITALS_DEADLINE_MIN) {
    candidates.push({
      key: "vitals",
      title: "Log morning vitals",
      reason: `It's past ${formatTime(VITALS_DEADLINE_MIN)} and today's glucose, blood pressure, and weight aren't logged.`,
      priority: "high",
      tag: "health",
      rank: 0
    });
  }

  // --- Missing training sessions vs the rolling deadlines ------------------
  const expectedTypes = input.requiredWorkoutTypes ?? requiredSessionTypes;
  const fitness = getDailyFitnessStatus(workouts, today, expectedTypes);
  const karateLogged = metrics.some(
    (entry) => entry.date === today && entry.karateClass === true
  );
  const sessionDone = (type: WorkoutType): boolean =>
    Boolean(fitness.byType[type]) || (type === "martial_arts" && karateLogged);
  const doneCount = expectedTypes.filter(sessionDone).length;

  let missingIndex = 0;
  for (const type of expectedTypes) {
    if (sessionDone(type)) {
      continue;
    }
    // The nth missing session occupies the nth remaining deadline slot,
    // exactly how dailyBrief's "expected by now" math treats the day.
    const deadline = WORKOUT_DEADLINES_MIN[doneCount + missingIndex];
    missingIndex += 1;
    const overdue = deadline !== undefined && nowMinutes > deadline;
    candidates.push({
      key: `session-${type}`,
      title: SESSION_TITLE[type],
      reason: overdue
        ? `Behind schedule — this session's ${formatTime(deadline)} window has passed with ${doneCount}/${expectedTypes.length} done.`
        : `${doneCount}/${expectedTypes.length} sessions done${deadline !== undefined ? ` — this one's window closes at ${formatTime(deadline)}` : ""}.`,
      priority: overdue ? "high" : "medium",
      tag: "health",
      rank: overdue ? 1 : 5
    });
  }

  // --- Protein vs today's target (afternoon nudge) --------------------------
  if (target && target.proteinTargetG > 0 && nowMinutes > MIDDAY_MIN) {
    const loggedProtein = sumMacros(getFoodEntriesForDate(foodEntries, today)).proteinG;
    if (loggedProtein < target.proteinTargetG * PROTEIN_NUDGE_RATIO) {
      candidates.push({
        key: "protein",
        title: "Hit your protein target",
        reason: `Only ${Math.round(loggedProtein)}g of today's ${Math.round(target.proteinTargetG)}g protein target is logged — build the next meals around protein.`,
        priority: "medium",
        tag: "health",
        rank: 2
      });
    }
  }

  // --- Water (afternoon nudge when under half the goal) ---------------------
  if (nowMinutes > MIDDAY_MIN && waterOz < WATER_NUDGE_OZ) {
    const remainingOz = Math.max(0, Math.round(DEFAULT_WATER_GOAL_OZ - waterOz));
    candidates.push({
      key: "water",
      title: `Drink water — ${remainingOz} oz to go`,
      reason: `Only ${Math.round(waterOz)} oz of the ${DEFAULT_WATER_GOAL_OZ} oz goal is logged and the morning's gone.`,
      priority: "medium",
      tag: "health",
      rank: 3
    });
  }

  // --- Daily plan ------------------------------------------------------------
  if (!dailyPlans.some((plan) => plan.date === today)) {
    candidates.push({
      key: "plan",
      title: "Plan your day",
      reason: "No daily plan yet — pick a main quest so the day has a spine.",
      priority: "medium",
      tag: "health",
      rank: 4
    });
  }

  // --- Dedupe against open quests created for today --------------------------
  // A suggestion is "already accepted" when an open (todo) task exists for
  // today with the same title. Water's title embeds the remaining ounces
  // (which shrink as the user drinks), so it matches on its stable prefix.
  const openTodayTitles = input.openTasks
    .filter(
      (task) =>
        task.status === "todo" &&
        (task.plannedForDate === today || isIsoTimestampOnDate(task.createdAt, today))
    )
    .map((task) => normalizeTitle(task.title));

  const alreadyAccepted = (suggestion: RankedSuggestion): boolean =>
    suggestion.key === "water"
      ? openTodayTitles.some((title) => title.startsWith("drink water"))
      : openTodayTitles.includes(normalizeTitle(suggestion.title));

  return candidates
    .filter((suggestion) => !alreadyAccepted(suggestion))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, MAX_SUGGESTIONS)
    .map(({ key, title, reason, priority, tag }) => ({ key, title, reason, priority, tag }));
}
