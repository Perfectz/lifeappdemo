import type {
  EntityId,
  Goal,
  GoalHorizon,
  GoalPillar,
  GoalStatus,
  IsoDate,
  IsoDateTime,
  Task
} from "@/domain/types";

export const goalPillars: GoalPillar[] = ["fitness", "personal", "professional"];
export const goalHorizons: GoalHorizon[] = ["vision", "yearly", "quarterly", "weekly"];
export const goalStatuses: GoalStatus[] = ["active", "achieved", "paused", "dropped"];

export type GoalInput = {
  pillar: GoalPillar;
  horizon: GoalHorizon;
  title: string;
  description?: string;
  parentGoalId?: EntityId;
  targetDate?: IsoDate;
  metricName?: string;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
};

export type GoalValidationResult =
  | { ok: true; value: GoalInput }
  | { ok: false; message: string };

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function optionalFiniteNumber(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function validateGoalInput(input: GoalInput): GoalValidationResult {
  const title = input.title?.trim() ?? "";

  if (!title) {
    return { ok: false, message: "Goal title is required." };
  }

  if (!goalPillars.includes(input.pillar)) {
    return { ok: false, message: "Goal pillar is invalid." };
  }

  if (!goalHorizons.includes(input.horizon)) {
    return { ok: false, message: "Goal horizon is invalid." };
  }

  return {
    ok: true,
    value: {
      pillar: input.pillar,
      horizon: input.horizon,
      title,
      description: normalizeOptionalText(input.description),
      parentGoalId: normalizeOptionalText(input.parentGoalId),
      targetDate: normalizeOptionalText(input.targetDate),
      metricName: normalizeOptionalText(input.metricName),
      targetValue: optionalFiniteNumber(input.targetValue),
      currentValue: optionalFiniteNumber(input.currentValue),
      unit: normalizeOptionalText(input.unit)
    }
  };
}

export function createGoal(input: GoalInput, now: IsoDateTime = new Date().toISOString()): Goal {
  const validation = validateGoalInput(input);

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  return {
    id: globalThis.crypto?.randomUUID?.() ?? `goal-${now}`,
    ...validation.value,
    status: "active",
    createdAt: now,
    updatedAt: now
  };
}

export function updateGoal(
  goal: Goal,
  input: Partial<GoalInput> & { status?: GoalStatus },
  now: IsoDateTime = new Date().toISOString()
): Goal {
  const merged: GoalInput = {
    pillar: input.pillar ?? goal.pillar,
    horizon: input.horizon ?? goal.horizon,
    title: input.title ?? goal.title,
    description: input.description ?? goal.description,
    parentGoalId: input.parentGoalId ?? goal.parentGoalId,
    targetDate: input.targetDate ?? goal.targetDate,
    metricName: input.metricName ?? goal.metricName,
    targetValue: input.targetValue ?? goal.targetValue,
    currentValue: input.currentValue ?? goal.currentValue,
    unit: input.unit ?? goal.unit
  };

  const validation = validateGoalInput(merged);

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const status = input.status && goalStatuses.includes(input.status) ? input.status : goal.status;

  return {
    ...goal,
    ...validation.value,
    status,
    updatedAt: now
  };
}

/** Progress toward a measurable target as a 0-1 fraction, or undefined if not measurable. */
export function goalProgressFraction(goal: Goal): number | undefined {
  if (
    typeof goal.targetValue !== "number" ||
    typeof goal.currentValue !== "number" ||
    goal.targetValue === 0
  ) {
    return undefined;
  }

  const fraction = goal.currentValue / goal.targetValue;
  return Math.max(0, Math.min(1, fraction));
}

/**
 * Progress from linked quests. Used when a goal does not have a numeric metric,
 * so every active goal can still show concrete movement.
 */
export function goalQuestProgressFraction(goal: Goal, tasks: Task[]): number | undefined {
  const linked = tasks.filter((task) => task.linkedGoalId === goal.id && task.status !== "archived");
  if (linked.length === 0) return undefined;
  const completed = linked.filter((task) => task.status === "done").length;
  return completed / linked.length;
}

export function effectiveGoalProgressFraction(goal: Goal, tasks: Task[]): number | undefined {
  return goalProgressFraction(goal) ?? goalQuestProgressFraction(goal, tasks);
}

export function isGoal(value: unknown): value is Goal {
  if (!value || typeof value !== "object") {
    return false;
  }

  const goal = value as Partial<Goal>;

  return (
    typeof goal.id === "string" &&
    typeof goal.title === "string" &&
    goal.title.trim().length > 0 &&
    goal.pillar !== undefined &&
    goalPillars.includes(goal.pillar) &&
    goal.horizon !== undefined &&
    goalHorizons.includes(goal.horizon) &&
    goal.status !== undefined &&
    goalStatuses.includes(goal.status) &&
    typeof goal.createdAt === "string" &&
    typeof goal.updatedAt === "string"
  );
}
