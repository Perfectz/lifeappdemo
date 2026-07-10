import type { IsoDate, MetricEntry, Workout, WorkoutType } from "@/domain/types";
import { getDailyFitnessStatus } from "@/domain/dailyFitness";
import { VITALS_DEADLINE_MIN, WORKOUT_DEADLINES_MIN } from "@/domain/dailyBrief";

/**
 * Pure logic for the scheduled push reminders. Given a user's data and the
 * current local time, decide which reminders just became due (deadline passed
 * within the window) and aren't satisfied yet. The cron job runs this per user.
 */

export type DueReminder = {
  id: string;
  title: string;
  body: string;
  url: string;
};

export type ReminderInput = {
  today: IsoDate;
  nowMinutes: number;
  metrics: MetricEntry[];
  workouts: Workout[];
  requiredWorkoutTypes?: WorkoutType[];
  /** Only fire reminders whose deadline passed within the last N minutes. */
  windowMinutes?: number;
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

export function getDueReminders(input: ReminderInput): DueReminder[] {
  const { today, nowMinutes, metrics, workouts, windowMinutes = 30 } = input;
  const fitness = getDailyFitnessStatus(workouts, today, input.requiredWorkoutTypes);
  const completed = fitness.completedCount;
  const due: DueReminder[] = [];

  const justPassed = (deadline: number) =>
    nowMinutes >= deadline && nowMinutes - deadline < windowMinutes;

  if (justPassed(VITALS_DEADLINE_MIN) && !vitalsLoggedToday(metrics, today)) {
    due.push({
      id: "vitals",
      title: "Log your vitals",
      body: "It's past 7:30 — log today's glucose, blood pressure, and weight.",
      url: "/vitals"
    });
  }

  const workoutCopy = [
    "Time for your first workout — get it in before 9am.",
    "Second workout time — fit it in by 6pm.",
    "Last workout of the day — wrap it up before 9pm."
  ];

  WORKOUT_DEADLINES_MIN.slice(0, fitness.expectedCount).forEach((deadline, index) => {
    if (justPassed(deadline) && completed < index + 1) {
      due.push({
        id: `workout-${index + 1}`,
        title: "Workout reminder",
        body: workoutCopy[index] ?? "You have a workout left today.",
        url: "/fitness"
      });
    }
  });

  return due;
}
