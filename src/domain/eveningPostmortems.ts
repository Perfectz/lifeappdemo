import type {
  DailyPlan,
  EntityId,
  EveningPostmortem,
  EveningTaskOutcome,
  IsoDate,
  IsoDateTime,
  Task,
  TaskOutcome
} from "@/domain/types";
import { closeDailyPlan } from "@/domain/dailyPlans";
import { completeTask } from "@/domain/tasks";

export const taskOutcomes: TaskOutcome[] = ["completed", "deferred", "left_open"];

export type EveningPostmortemInput = {
  date: IsoDate;
  dailyPlanId?: EntityId;
  taskOutcomes: EveningTaskOutcome[];
  wins?: string;
  friction?: string;
  lessonsLearned?: string;
  tomorrowFollowUps?: string;
};

export type EveningPostmortemValidationResult =
  | { ok: true; value: EveningPostmortemInput }
  | { ok: false; message: string };

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function validateEveningPostmortemInput(
  input: EveningPostmortemInput
): EveningPostmortemValidationResult {
  const date = input.date.trim();
  const taskOutcomesById = new Map<EntityId, EveningTaskOutcome>();

  if (!date) {
    return { ok: false, message: "Postmortem date is required." };
  }

  for (const taskOutcome of input.taskOutcomes) {
    if (!taskOutcome.taskId.trim()) {
      return { ok: false, message: "Task outcome is missing a task." };
    }

    if (!taskOutcomes.includes(taskOutcome.outcome)) {
      return { ok: false, message: "Task outcome is invalid." };
    }

    taskOutcomesById.set(taskOutcome.taskId, {
      taskId: taskOutcome.taskId,
      outcome: taskOutcome.outcome,
      note: normalizeOptionalText(taskOutcome.note)
    });
  }

  return {
    ok: true,
    value: {
      date,
      dailyPlanId: normalizeOptionalText(input.dailyPlanId),
      taskOutcomes: [...taskOutcomesById.values()],
      wins: normalizeOptionalText(input.wins),
      friction: normalizeOptionalText(input.friction),
      lessonsLearned: normalizeOptionalText(input.lessonsLearned),
      tomorrowFollowUps: normalizeOptionalText(input.tomorrowFollowUps)
    }
  };
}

export function createEveningPostmortem(
  input: EveningPostmortemInput,
  now: IsoDateTime = new Date().toISOString()
): EveningPostmortem {
  const validation = validateEveningPostmortemInput(input);

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  return {
    id: globalThis.crypto?.randomUUID?.() ?? `evening-postmortem-${now}`,
    date: validation.value.date,
    dailyPlanId: validation.value.dailyPlanId,
    taskOutcomes: validation.value.taskOutcomes,
    wins: validation.value.wins,
    friction: validation.value.friction,
    lessonsLearned: validation.value.lessonsLearned,
    tomorrowFollowUps: validation.value.tomorrowFollowUps,
    createdAt: now,
    updatedAt: now
  };
}

export function updateEveningPostmortem(
  postmortem: EveningPostmortem,
  input: EveningPostmortemInput,
  now: IsoDateTime = new Date().toISOString()
): EveningPostmortem {
  const validation = validateEveningPostmortemInput(input);

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  return {
    ...postmortem,
    date: validation.value.date,
    dailyPlanId: validation.value.dailyPlanId,
    taskOutcomes: validation.value.taskOutcomes,
    wins: validation.value.wins,
    friction: validation.value.friction,
    lessonsLearned: validation.value.lessonsLearned,
    tomorrowFollowUps: validation.value.tomorrowFollowUps,
    updatedAt: now
  };
}

export function upsertEveningPostmortemForDate(
  postmortems: EveningPostmortem[],
  input: EveningPostmortemInput,
  now: IsoDateTime = new Date().toISOString()
): EveningPostmortem[] {
  const existing = postmortems.find((postmortem) => postmortem.date === input.date);
  const nextPostmortem = existing
    ? updateEveningPostmortem(existing, input, now)
    : createEveningPostmortem(input, now);

  if (!existing) {
    return [nextPostmortem, ...postmortems];
  }

  return postmortems.map((postmortem) =>
    postmortem.id === existing.id ? nextPostmortem : postmortem
  );
}

export function applyTaskOutcomes(
  tasks: Task[],
  outcomes: EveningTaskOutcome[],
  now: IsoDateTime = new Date().toISOString()
): Task[] {
  const outcomeByTaskId = new Map(outcomes.map((outcome) => [outcome.taskId, outcome.outcome]));

  return tasks.map((task) => {
    const outcome = outcomeByTaskId.get(task.id);

    if (outcome === "completed") {
      return completeTask(task, now);
    }

    if (outcome === "deferred") {
      return {
        ...task,
        status: "todo",
        completedAt: undefined,
        plannedForDate: undefined,
        updatedAt: now
      };
    }

    if (outcome === "left_open") {
      return {
        ...task,
        status: "todo",
        completedAt: undefined,
        updatedAt: now
      };
    }

    return task;
  });
}

export function closePlanAfterPostmortem(
  plans: DailyPlan[],
  dailyPlanId: EntityId | undefined,
  now: IsoDateTime = new Date().toISOString()
): DailyPlan[] {
  if (!dailyPlanId) {
    return plans;
  }

  return plans.map((plan) => (plan.id === dailyPlanId ? closeDailyPlan(plan, now) : plan));
}

export function getEveningPostmortemForDate(
  postmortems: EveningPostmortem[],
  date: IsoDate
): EveningPostmortem | undefined {
  return postmortems.find((postmortem) => postmortem.date === date);
}

export function isEveningPostmortem(value: unknown): value is EveningPostmortem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const postmortem = value as Partial<EveningPostmortem>;

  return (
    typeof postmortem.id === "string" &&
    typeof postmortem.date === "string" &&
    (postmortem.dailyPlanId === undefined || typeof postmortem.dailyPlanId === "string") &&
    Array.isArray(postmortem.taskOutcomes) &&
    postmortem.taskOutcomes.every(
      (taskOutcome) =>
        typeof taskOutcome.taskId === "string" &&
        taskOutcomes.includes(taskOutcome.outcome) &&
        (taskOutcome.note === undefined || typeof taskOutcome.note === "string")
    ) &&
    (postmortem.wins === undefined || typeof postmortem.wins === "string") &&
    (postmortem.friction === undefined || typeof postmortem.friction === "string") &&
    (postmortem.lessonsLearned === undefined ||
      typeof postmortem.lessonsLearned === "string") &&
    (postmortem.tomorrowFollowUps === undefined ||
      typeof postmortem.tomorrowFollowUps === "string") &&
    typeof postmortem.createdAt === "string" &&
    typeof postmortem.updatedAt === "string"
  );
}
