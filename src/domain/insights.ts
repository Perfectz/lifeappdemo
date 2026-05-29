import type { IsoDate, MetricEntry, Task, TaskTag } from "@/domain";
import { isIsoTimestampOnDate, toLocalIsoDate } from "@/domain/dates";

export type DayPoint = {
  date: IsoDate;
  /** Day-of-week label, e.g. "Mon". */
  label: string;
  value: number;
};

export type CompletionTrend = {
  points: DayPoint[];
  total: number;
  best: number;
  average: number;
};

export type MetricTrendPoint = {
  date: IsoDate;
  label: string;
  energy: number | null;
  mood: number | null;
};

export type MetricTrend = {
  points: MetricTrendPoint[];
  avgEnergy: number | null;
  avgMood: number | null;
};

export type TagStat = {
  tag: TaskTag;
  completed: number;
  open: number;
};

export type WeekProgress = {
  completed: number;
  goal: number;
  pct: number;
  daysActive: number;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function shiftDate(date: IsoDate, deltaDays: number): IsoDate {
  const [year, month, day] = date.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + deltaDays);
  return toLocalIsoDate(d);
}

function weekdayLabel(date: IsoDate): string {
  const [year, month, day] = date.split("-").map(Number);
  return WEEKDAY_LABELS[new Date(year, month - 1, day).getDay()];
}

function lastNDates(today: IsoDate, days: number): IsoDate[] {
  const dates: IsoDate[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    dates.push(shiftDate(today, -i));
  }
  return dates;
}

export function getCompletionTrend(
  tasks: Task[],
  today: IsoDate,
  days = 14
): CompletionTrend {
  const dates = lastNDates(today, days);
  const counts = new Map<string, number>(dates.map((date) => [date, 0]));

  for (const task of tasks) {
    if (!task.completedAt) continue;
    for (const date of dates) {
      if (isIsoTimestampOnDate(task.completedAt, date)) {
        counts.set(date, (counts.get(date) ?? 0) + 1);
        break;
      }
    }
  }

  const points: DayPoint[] = dates.map((date) => ({
    date,
    label: weekdayLabel(date),
    value: counts.get(date) ?? 0
  }));

  const total = points.reduce((sum, point) => sum + point.value, 0);
  const best = points.reduce((max, point) => Math.max(max, point.value), 0);
  const average = points.length > 0 ? total / points.length : 0;

  return { points, total, best, average };
}

export function getMetricTrend(
  metrics: MetricEntry[],
  today: IsoDate,
  days = 14
): MetricTrend {
  const dates = lastNDates(today, days);
  const byDate = new Map<string, { energy: number[]; mood: number[] }>(
    dates.map((date) => [date, { energy: [], mood: [] }])
  );

  for (const metric of metrics) {
    const bucket = byDate.get(metric.date);
    if (!bucket) continue;
    if (typeof metric.energyLevel === "number") bucket.energy.push(metric.energyLevel);
    if (typeof metric.moodLevel === "number") bucket.mood.push(metric.moodLevel);
  }

  function avg(values: number[]): number | null {
    if (values.length === 0) return null;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  const points: MetricTrendPoint[] = dates.map((date) => {
    const bucket = byDate.get(date) ?? { energy: [], mood: [] };
    return {
      date,
      label: weekdayLabel(date),
      energy: avg(bucket.energy),
      mood: avg(bucket.mood)
    };
  });

  const allEnergy = points.map((p) => p.energy).filter((v): v is number => v !== null);
  const allMood = points.map((p) => p.mood).filter((v): v is number => v !== null);

  return {
    points,
    avgEnergy: avg(allEnergy),
    avgMood: avg(allMood)
  };
}

export function getTagBreakdown(tasks: Task[]): TagStat[] {
  const stats = new Map<TaskTag, TagStat>();
  for (const task of tasks) {
    for (const tag of task.tags) {
      const existing = stats.get(tag) ?? { tag, completed: 0, open: 0 };
      if (task.status === "done" || task.completedAt) {
        existing.completed += 1;
      } else if (task.status === "todo") {
        existing.open += 1;
      }
      stats.set(tag, existing);
    }
  }
  return [...stats.values()].sort(
    (a, b) => b.completed + b.open - (a.completed + a.open)
  );
}

export function getWeekProgress(tasks: Task[], today: IsoDate, goal = 10): WeekProgress {
  const weekDates = lastNDates(today, 7);
  const activeDays = new Set<string>();
  let completed = 0;
  for (const task of tasks) {
    if (!task.completedAt) continue;
    for (const date of weekDates) {
      if (isIsoTimestampOnDate(task.completedAt, date)) {
        completed += 1;
        activeDays.add(date);
        break;
      }
    }
  }
  const pct = goal > 0 ? Math.min(100, Math.round((completed / goal) * 100)) : 0;
  return { completed, goal, pct, daysActive: activeDays.size };
}

/**
 * Human-readable patterns derived from real data. Surfaced on the
 * Trends page and folded into the AI coach context so coaching is
 * grounded in the player's actual history, not generic advice.
 */
export function getInsightHighlights(
  tasks: Task[],
  metrics: MetricEntry[],
  today: IsoDate
): string[] {
  const highlights: string[] = [];

  const completion = getCompletionTrend(tasks, today, 14);
  if (completion.total > 0) {
    // Best weekday by completion.
    const byWeekday = new Map<string, number>();
    for (const point of completion.points) {
      byWeekday.set(point.label, (byWeekday.get(point.label) ?? 0) + point.value);
    }
    let bestDay = "";
    let bestCount = 0;
    for (const [label, count] of byWeekday) {
      if (count > bestCount) {
        bestCount = count;
        bestDay = label;
      }
    }
    if (bestDay) {
      highlights.push(
        `Most quests cleared on ${bestDay} over the last two weeks (${bestCount}).`
      );
    }
    highlights.push(
      `Averaging ${completion.average.toFixed(1)} quests cleared per day (14-day).`
    );
  }

  const tags = getTagBreakdown(tasks);
  const topCompleted = [...tags].sort((a, b) => b.completed - a.completed)[0];
  if (topCompleted && topCompleted.completed > 0) {
    highlights.push(`Strongest area: "${topCompleted.tag}" (${topCompleted.completed} cleared).`);
  }
  const mostOpen = [...tags].sort((a, b) => b.open - a.open)[0];
  if (mostOpen && mostOpen.open >= 3 && mostOpen.tag !== topCompleted?.tag) {
    highlights.push(`Backlog building in "${mostOpen.tag}" (${mostOpen.open} open).`);
  }

  const metricTrend = getMetricTrend(metrics, today, 14);
  if (metricTrend.avgEnergy !== null) {
    highlights.push(`Average energy ${metricTrend.avgEnergy.toFixed(1)}/5 over two weeks.`);
  }
  if (metricTrend.avgMood !== null) {
    highlights.push(`Average mood ${metricTrend.avgMood.toFixed(1)}/5 over two weeks.`);
  }

  if (highlights.length === 0) {
    highlights.push("Not enough history yet — log quests and check-ins to unlock insights.");
  }

  return highlights;
}
