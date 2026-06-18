import type {
  DailyPlan,
  EveningPostmortem,
  IsoDate,
  MetricEntry,
  Task,
  Workout,
  WorkoutType
} from "@/domain/types";
import { getDailyFitnessStatus } from "@/domain/dailyFitness";

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
  eveningPostmortems: EveningPostmortem[];
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
  const { today, nowMinutes, workouts, metrics, dailyPlans, eveningPostmortems } = input;
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

  const fitness = getDailyFitnessStatus(workouts, today);
  if (!fitness.isComplete) {
    const done = fitness.completedCount;
    const expectedByNow = WORKOUT_DEADLINES_MIN.filter((deadline) => nowMinutes > deadline).length;
    const overdue = done < expectedByNow;
    const missing = (Object.keys(fitness.byType) as WorkoutType[])
      .filter((type) => !fitness.byType[type])
      .map((type) => SESSION_LABEL[type]);
    const nextDeadline = WORKOUT_DEADLINES_MIN[done];
    focus.push({
      id: "fitness",
      overdue,
      message: overdue
        ? `You're behind on workouts — ${expectedByNow} should be done by now, but only ${done}/3 are${missing.length ? ` (still need ${missing.join(", ")})` : ""}.`
        : `${done}/3 workouts done${nextDeadline !== undefined ? ` — next by ${formatTime(nextDeadline)}` : ""}.`,
      ctaLabel: "Open Fitness",
      href: "/fitness"
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

  const eveningDone = eveningPostmortems.some((postmortem) => postmortem.date === today);
  if (nowMinutes >= 18 * 60 && todayPlan && !eveningDone) {
    focus.push({
      id: "evening",
      message: "Close out the day with an evening postmortem.",
      ctaLabel: "Evening review",
      href: "/standup/evening"
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
