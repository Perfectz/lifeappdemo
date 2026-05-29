import type { IsoDate, MetricEntry, MetricLevel, Task } from "@/domain";
import { isIsoTimestampOnDate, toLocalIsoDate } from "@/domain/dates";
import { getLatestMetricEntry } from "@/domain/metrics";

/**
 * Status pulled from tasks + metrics for the JRPG-style hero card.
 * All values are intentionally bounded so the menu chrome can render
 * them with PSX-era columnar layouts (e.g. HP 87/100).
 */
export type HeroStatus = {
  level: number;
  totalCompleted: number;
  xpCurrent: number;
  xpForNextLevel: number;
  hp: MetricLevel | undefined;
  mp: MetricLevel | undefined;
  hpMax: 5;
  mpMax: 5;
  streakDays: number;
  questsToday: { planned: number; completed: number };
};

const TASKS_PER_LEVEL = 5;

export function getHeroStatus(tasks: Task[], metrics: MetricEntry[], today: IsoDate): HeroStatus {
  const totalCompleted = tasks.filter((task) => Boolean(task.completedAt)).length;
  const level = Math.floor(totalCompleted / TASKS_PER_LEVEL) + 1;
  const xpCurrent = totalCompleted % TASKS_PER_LEVEL;

  const latestMetric = getLatestMetricEntry(metrics);

  const completedToday = tasks.filter((task) =>
    isIsoTimestampOnDate(task.completedAt, today)
  ).length;
  const plannedToday = tasks.filter(
    (task) => task.status === "todo" && task.plannedForDate === today
  ).length;

  return {
    level,
    totalCompleted,
    xpCurrent,
    xpForNextLevel: TASKS_PER_LEVEL,
    hp: latestMetric?.energyLevel,
    mp: latestMetric?.moodLevel,
    hpMax: 5,
    mpMax: 5,
    streakDays: computeStreak(tasks, today),
    questsToday: { planned: plannedToday, completed: completedToday }
  };
}

/**
 * Consecutive days (ending today) with at least one completed task.
 * Today only counts if at least one task was completed; otherwise the
 * streak shows the run that ended yesterday so the UI doesn't punish
 * users mid-morning.
 */
export function computeStreak(tasks: Task[], today: IsoDate): number {
  const daysWithWork = new Set<string>();

  for (const task of tasks) {
    if (!task.completedAt) {
      continue;
    }
    const stamp = new Date(task.completedAt);
    if (Number.isNaN(stamp.getTime())) {
      continue;
    }
    daysWithWork.add(toLocalIsoDate(stamp));
  }

  if (daysWithWork.size === 0) {
    return 0;
  }

  const [year, month, day] = today.split("-").map(Number);
  const cursor = new Date(year, month - 1, day);
  let streak = 0;

  // If today has no completion yet, start counting from yesterday so
  // the player keeps their streak through the morning.
  if (!daysWithWork.has(today)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (daysWithWork.has(toLocalIsoDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function formatHpMp(value: MetricLevel | undefined, max: number): string {
  if (value === undefined) {
    return `--/${max}`;
  }
  return `${value}/${max}`;
}
