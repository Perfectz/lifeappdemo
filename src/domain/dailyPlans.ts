import type { DailyPlan, EntityId, IsoDate, IsoDateTime, Task } from "@/domain/types";

export type DailyPlanInput = {
  date: IsoDate;
  mainQuestTaskId?: EntityId;
  sideQuestTaskIds: EntityId[];
  intention?: string;
};

export type DailyPlanValidationResult =
  | { ok: true; value: DailyPlanInput }
  | { ok: false; message: string };

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getActiveTaskIds(tasks: Task[]): Set<EntityId> {
  return new Set(tasks.filter((task) => task.status === "todo").map((task) => task.id));
}

export function validateDailyPlanInput(
  input: DailyPlanInput,
  tasks: Task[]
): DailyPlanValidationResult {
  const activeTaskIds = getActiveTaskIds(tasks);
  const date = input.date.trim();
  const mainQuestTaskId = normalizeOptionalText(input.mainQuestTaskId);
  const sideQuestTaskIds = input.sideQuestTaskIds.filter(Boolean);
  const uniqueSideQuestTaskIds = [...new Set(sideQuestTaskIds)];

  if (!date) {
    return { ok: false, message: "Plan date is required." };
  }

  if (mainQuestTaskId && !activeTaskIds.has(mainQuestTaskId)) {
    return { ok: false, message: "Main Quest must be an active quest." };
  }

  if (uniqueSideQuestTaskIds.length > 3) {
    return { ok: false, message: "Choose up to three Side Quests." };
  }

  if (mainQuestTaskId && uniqueSideQuestTaskIds.includes(mainQuestTaskId)) {
    return { ok: false, message: "Main Quest cannot also be a Side Quest." };
  }

  if (uniqueSideQuestTaskIds.some((taskId) => !activeTaskIds.has(taskId))) {
    return { ok: false, message: "Side Quests must be active quests." };
  }

  return {
    ok: true,
    value: {
      date,
      mainQuestTaskId,
      sideQuestTaskIds: uniqueSideQuestTaskIds,
      intention: normalizeOptionalText(input.intention)
    }
  };
}

export function createDailyPlan(
  input: DailyPlanInput,
  tasks: Task[],
  now: IsoDateTime = new Date().toISOString()
): DailyPlan {
  const validation = validateDailyPlanInput(input, tasks);

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  return {
    id: globalThis.crypto?.randomUUID?.() ?? `daily-plan-${now}`,
    date: validation.value.date,
    mainQuestTaskId: validation.value.mainQuestTaskId,
    sideQuestTaskIds: validation.value.sideQuestTaskIds,
    intention: validation.value.intention,
    status: "planned",
    createdAt: now,
    updatedAt: now
  };
}

export function updateDailyPlan(
  plan: DailyPlan,
  input: DailyPlanInput,
  tasks: Task[],
  now: IsoDateTime = new Date().toISOString()
): DailyPlan {
  const validation = validateDailyPlanInput(input, tasks);

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  return {
    ...plan,
    date: validation.value.date,
    mainQuestTaskId: validation.value.mainQuestTaskId,
    sideQuestTaskIds: validation.value.sideQuestTaskIds,
    intention: validation.value.intention,
    updatedAt: now
  };
}

export function upsertDailyPlanForDate(
  plans: DailyPlan[],
  input: DailyPlanInput,
  tasks: Task[],
  now: IsoDateTime = new Date().toISOString()
): DailyPlan[] {
  const existingPlan = plans.find((plan) => plan.date === input.date && plan.status === "planned");
  const nextPlan = existingPlan
    ? updateDailyPlan(existingPlan, input, tasks, now)
    : createDailyPlan(input, tasks, now);

  if (!existingPlan) {
    return [nextPlan, ...plans];
  }

  return plans.map((plan) => (plan.id === existingPlan.id ? nextPlan : plan));
}

export function getActiveDailyPlanForDate(
  plans: DailyPlan[],
  date: IsoDate
): DailyPlan | undefined {
  return plans.find((plan) => plan.date === date && plan.status === "planned");
}

export function getDailyPlanForDate(plans: DailyPlan[], date: IsoDate): DailyPlan | undefined {
  return plans.find((plan) => plan.date === date);
}

export function closeDailyPlan(
  plan: DailyPlan,
  now: IsoDateTime = new Date().toISOString()
): DailyPlan {
  return {
    ...plan,
    status: "closed",
    updatedAt: now
  };
}

export function isDailyPlan(value: unknown): value is DailyPlan {
  if (!value || typeof value !== "object") {
    return false;
  }

  const plan = value as Partial<DailyPlan>;

  return (
    typeof plan.id === "string" &&
    typeof plan.date === "string" &&
    Array.isArray(plan.sideQuestTaskIds) &&
    plan.sideQuestTaskIds.every((taskId) => typeof taskId === "string") &&
    (plan.mainQuestTaskId === undefined || typeof plan.mainQuestTaskId === "string") &&
    (plan.intention === undefined || typeof plan.intention === "string") &&
    plan.status !== undefined &&
    ["planned", "closed"].includes(plan.status) &&
    typeof plan.createdAt === "string" &&
    typeof plan.updatedAt === "string"
  );
}
