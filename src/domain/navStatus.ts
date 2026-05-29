import type { DailyPlan, EveningPostmortem, IsoDate, Task } from "@/domain";

/**
 * Status overlay for a single nav item. The shell uses this to render
 * pulse markers and overdue counts that nudge the player toward the
 * next sensible action without requiring them to read every label.
 */
export type NavStatus = {
  /** Numeric badge to show on the row, or undefined for no badge. */
  badge?: number;
  /** Whether to apply the gold pulse marker to the row. */
  pulse?: boolean;
  /** Optional aria/title text describing the state. */
  hint?: string;
};

export type NavStatusMap = Partial<Record<string, NavStatus>>;

export type NavStatusInputs = {
  tasks: Task[];
  plans: DailyPlan[];
  postmortems: EveningPostmortem[];
  today: IsoDate;
  /** Hour in 0-23, used to decide whether to nudge for morning vs evening. */
  hour: number;
};

const MORNING_NUDGE_HOUR = 12; // before noon
const EVENING_NUDGE_HOUR = 19; // after 7pm

export function getNavStatusMap(inputs: NavStatusInputs): NavStatusMap {
  const { tasks, plans, postmortems, today, hour } = inputs;
  const map: NavStatusMap = {};

  const planForToday = plans.find((plan) => plan.date === today);
  if (hour < MORNING_NUDGE_HOUR && !planForToday) {
    map["/standup/morning"] = {
      pulse: true,
      hint: "Plan today — morning stand-up not yet logged"
    };
  }

  const postmortemForToday = postmortems.find(
    (postmortem) => postmortem.date === today
  );
  if (hour >= EVENING_NUDGE_HOUR && !postmortemForToday) {
    map["/standup/evening"] = {
      pulse: true,
      hint: "Close out the day — evening postmortem not yet logged"
    };
  }

  const overdueCount = tasks.filter(
    (task) =>
      task.status === "todo" &&
      task.plannedForDate !== undefined &&
      task.plannedForDate < today
  ).length;

  if (overdueCount > 0) {
    map["/tasks"] = {
      badge: overdueCount,
      pulse: true,
      hint: `${overdueCount} quest${overdueCount === 1 ? "" : "s"} overdue`
    };
  }

  return map;
}
