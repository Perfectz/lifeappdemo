import type {
  DailyPlan,
  FoodEntry,
  IsoDate,
  MetricEntry,
  Task,
  Workout,
  WorkoutType
} from "@/domain/types";
import { getDailyFitnessStatus } from "@/domain/dailyFitness";
import type { DailyNutritionTarget } from "@/domain/dailyNutritionTarget";
import { getFoodEntriesForDate, sumMacros } from "@/domain/nutrition";
import { DEFAULT_WATER_GOAL_OZ } from "@/domain/waterTracking";

/**
 * A coach-style "what needs you today" briefing for the dashboard. Pure +
 * deterministic so it's instant, offline, free, and reliably points at the
 * right screen — each focus item carries a CTA + href and an overdue flag
 * based on the user's daily schedule.
 */

/** The user's daily deadlines, in minutes since local midnight. */
export const VITALS_DEADLINE_MIN = 7 * 60 + 30; // 07:30
export const WORKOUT_DEADLINES_MIN = [9 * 60, 18 * 60, 21 * 60]; // 1st by 9:00, 2nd by 18:00, 3rd by 21:00

export type FocusItem = {
  id: string;
  message: string;
  ctaLabel: string;
  href: string;
  overdue?: boolean;
};

export type DailyBrief = {
  timeOfDay: "morning" | "afternoon" | "evening";
  summary: string;
  focus: FocusItem[];
  allClear: boolean;
};

const SESSION_LABEL: Record<WorkoutType, string> = {
  strength: "strength",
  cardio: "cardio",
  martial_arts: "martial arts"
};

export type DailyBriefInput = {
  today: IsoDate;
  /** Minutes since local midnight (e.g. 7:30am = 450). */
  nowMinutes: number;
  tasks: Task[];
  workouts: Workout[];
  metrics: MetricEntry[];
  dailyPlans: DailyPlan[];
  foodEntries?: FoodEntry[];
  nutritionTarget?: DailyNutritionTarget;
  waterOz?: number;
  requiredWorkoutTypes?: WorkoutType[];
};

function vitalsLoggedToday(metrics: MetricEntry[], today: IsoDate): boolean {
  return metrics.some(
    (entry) =>
      entry.date === today &&
      (entry.bloodPressureSystolic !== undefined ||
        entry.bloodGlucoseMgDl !== undefined ||
        entry.weightLbs !== undefined)
  );
}

function formatTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour >= 12 ? "pm" : "am";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return minute === 0
    ? `${displayHour}${period}`
    : `${displayHour}:${String(minute).padStart(2, "0")}${period}`;
}

export function buildDailyBrief(input: DailyBriefInput): DailyBrief {
  const { today, nowMinutes, tasks, workouts, metrics, dailyPlans } = input;
  const hour = Math.floor(nowMinutes / 60);
  const focus: FocusItem[] = [];

  if (!vitalsLoggedToday(metrics, today)) {
    const overdue = nowMinutes > VITALS_DEADLINE_MIN;
    focus.push({
      id: "vitals",
      overdue,
      message: overdue
        ? `Vitals are overdue — it's past ${formatTime(VITALS_DEADLINE_MIN)} and today's glucose, blood pressure, and weight aren't logged.`
        : "Log today's vitals (glucose, blood pressure, weight).",
      ctaLabel: "Log vitals",
      href: "/vitals"
    });
  }

  const fitness = getDailyFitnessStatus(workouts, today, input.requiredWorkoutTypes);
  if (!fitness.isComplete) {
    const done = fitness.completedCount;
    const expectedByNow = WORKOUT_DEADLINES_MIN.filter((deadline) => nowMinutes > deadline).length;
    const overdue = done < Math.min(expectedByNow, fitness.expectedCount);
    const missing = fitness.expectedTypes.filter((type) => !fitness.byType[type])
      .map((type) => SESSION_LABEL[type]);
    const nextDeadline = WORKOUT_DEADLINES_MIN[done];
    focus.push({
      id: "fitness",
      overdue,
      message: overdue
        ? `You're behind on training — ${Math.min(expectedByNow, fitness.expectedCount)} should be done by now, but only ${done}/${fitness.expectedCount} are${missing.length ? ` (still need ${missing.join(", ")})` : ""}.`
        : `${done}/${fitness.expectedCount} scheduled sessions done${nextDeadline !== undefined ? ` — next by ${formatTime(nextDeadline)}` : ""}.`,
      ctaLabel: "Open Fitness",
      href: "/fitness"
    });
  }

  const overdueTasks = tasks
    .filter(
      (task) =>
        task.status === "todo" &&
        ((task.dueDate !== undefined && task.dueDate < today) ||
          (task.plannedForDate !== undefined && task.plannedForDate < today))
    )
    .sort((a, b) =>
      (a.dueDate ?? a.plannedForDate ?? "").localeCompare(
        b.dueDate ?? b.plannedForDate ?? ""
      )
    );
  if (overdueTasks.length > 0) {
    focus.push({
      id: "overdue-quests",
      overdue: true,
      message: `${overdueTasks.length} quest${overdueTasks.length === 1 ? " is" : "s are"} overdue — start with “${overdueTasks[0].title}”.`,
      ctaLabel: "Review quests",
      href: "/tasks"
    });
  }

  if (nowMinutes > 12 * 60 && input.nutritionTarget && input.foodEntries) {
    const protein = sumMacros(getFoodEntriesForDate(input.foodEntries, today)).proteinG;
    if (protein < input.nutritionTarget.proteinTargetG * 0.6) {
      focus.push({
        id: "protein",
        message: `${Math.round(protein)}g of ${Math.round(input.nutritionTarget.proteinTargetG)}g protein logged — plan the next protein-forward meal.`,
        ctaLabel: "Open food diary",
        href: "/nutrition"
      });
    }
  }

  if (
    nowMinutes > 12 * 60 &&
    input.waterOz !== undefined &&
    input.waterOz < DEFAULT_WATER_GOAL_OZ / 2
  ) {
    focus.push({
      id: "water",
      message: `${Math.round(input.waterOz)} oz of ${DEFAULT_WATER_GOAL_OZ} oz water logged — catch up this afternoon.`,
      ctaLabel: "Log water",
      href: "/nutrition"
    });
  }

  const todayPlan = dailyPlans.find((plan) => plan.date === today);
  if (!todayPlan) {
    focus.push({
      id: "morning",
      message: "You haven't planned today yet — pick a main quest in your morning stand-up.",
      ctaLabel: "Plan my day",
      href: "/standup/morning"
    });
  }

  // Overdue items float to the top (stable within each group).
  focus.sort((a, b) => Number(Boolean(b.overdue)) - Number(Boolean(a.overdue)));

  const allClear = focus.length === 0;
  const overdueCount = focus.filter((item) => item.overdue).length;
  const timeOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const summary = allClear
    ? "You're all caught up — nice work."
    : overdueCount > 0
      ? `${overdueCount} thing${overdueCount === 1 ? "" : "s"} overdue — let's catch up.`
      : focus.length === 1
        ? "One thing needs your attention today."
        : `${focus.length} things need your attention today.`;

  return { timeOfDay, summary, focus, allClear };
}
