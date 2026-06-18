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
 * right screen — each focus item carries a CTA + href.
 */

export type FocusItem = {
  id: string;
  message: string;
  ctaLabel: string;
  href: string;
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
  hour: number;
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

export function buildDailyBrief(input: DailyBriefInput): DailyBrief {
  const { today, hour, workouts, metrics, dailyPlans, eveningPostmortems } = input;
  const focus: FocusItem[] = [];

  if (!vitalsLoggedToday(metrics, today)) {
    focus.push({
      id: "vitals",
      message: "You haven't logged today's vitals (glucose, blood pressure, weight).",
      ctaLabel: "Log vitals",
      href: "/vitals"
    });
  }

  const fitness = getDailyFitnessStatus(workouts, today);
  if (!fitness.isComplete) {
    const missing = (Object.keys(fitness.byType) as WorkoutType[])
      .filter((type) => !fitness.byType[type])
      .map((type) => SESSION_LABEL[type]);
    focus.push({
      id: "fitness",
      message: `${fitness.completedCount}/3 workouts done${
        missing.length ? ` — still need ${missing.join(", ")}` : ""
      }.`,
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
  if (hour >= 18 && todayPlan && !eveningDone) {
    focus.push({
      id: "evening",
      message: "Close out the day with an evening postmortem.",
      ctaLabel: "Evening review",
      href: "/standup/evening"
    });
  }

  const allClear = focus.length === 0;
  const timeOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const summary = allClear
    ? "You're all caught up — nice work."
    : focus.length === 1
      ? "One thing needs your attention today."
      : `${focus.length} things need your attention today.`;

  return { timeOfDay, summary, focus, allClear };
}
