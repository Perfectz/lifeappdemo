import type { IsoDate, IsoDateTime, Task, TaskPriority, TaskTag } from "@/domain/types";

export const taskPriorities: TaskPriority[] = ["low", "medium", "high"];
export const taskTags: TaskTag[] = [
  "health",
  "work",
  "content",
  "social",
  "admin",
  "learning"
];

export type TaskInput = {
  title: string;
  description?: string;
  priority: TaskPriority;
  tags: TaskTag[];
  dueDate?: IsoDate;
  plannedForDate?: IsoDate;
};

export type TaskGroups = {
  active: Task[];
  completed: Task[];
  archived: Task[];
};

export type TaskValidationResult =
  | { ok: true; value: TaskInput }
  | { ok: false; message: string };

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function validateTaskInput(input: TaskInput): TaskValidationResult {
  const title = input.title.trim();

  if (!title) {
    return {
      ok: false,
      message: "Quest title is required."
    };
  }

  return {
    ok: true,
    value: {
      title,
      description: normalizeOptionalText(input.description),
      priority: input.priority,
      tags: input.tags,
      dueDate: normalizeOptionalText(input.dueDate),
      plannedForDate: normalizeOptionalText(input.plannedForDate)
    }
  };
}

export function createTask(input: TaskInput, now: IsoDateTime = new Date().toISOString()): Task {
  const validation = validateTaskInput(input);

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  return {
    id: globalThis.crypto?.randomUUID?.() ?? `task-${now}`,
    title: validation.value.title,
    description: validation.value.description,
    status: "todo",
    priority: validation.value.priority,
    tags: validation.value.tags,
    dueDate: validation.value.dueDate,
    plannedForDate: validation.value.plannedForDate,
    createdAt: now,
    updatedAt: now
  };
}

export function updateTask(
  task: Task,
  input: TaskInput,
  now: IsoDateTime = new Date().toISOString()
): Task {
  const validation = validateTaskInput(input);

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  return {
    ...task,
    title: validation.value.title,
    description: validation.value.description,
    priority: validation.value.priority,
    tags: validation.value.tags,
    dueDate: validation.value.dueDate,
    plannedForDate: validation.value.plannedForDate,
    updatedAt: now
  };
}

export function completeTask(task: Task, now: IsoDateTime = new Date().toISOString()): Task {
  return {
    ...task,
    status: "done",
    completedAt: now,
    archivedAt: undefined,
    updatedAt: now
  };
}

export function reopenTask(task: Task, now: IsoDateTime = new Date().toISOString()): Task {
  return {
    ...task,
    status: "todo",
    completedAt: undefined,
    archivedAt: undefined,
    updatedAt: now
  };
}

export function archiveTask(task: Task, now: IsoDateTime = new Date().toISOString()): Task {
  return {
    ...task,
    status: "archived",
    archivedAt: now,
    updatedAt: now
  };
}

export function groupTasks(tasks: Task[]): TaskGroups {
  return {
    active: tasks.filter((task) => task.status === "todo"),
    completed: tasks.filter((task) => task.status === "done"),
    archived: tasks.filter((task) => task.status === "archived")
  };
}

export function isTask(value: unknown): value is Task {
  if (!value || typeof value !== "object") {
    return false;
  }

  const task = value as Partial<Task>;

  return (
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    task.title.trim().length > 0 &&
    task.status !== undefined &&
    ["todo", "done", "archived"].includes(task.status) &&
    task.priority !== undefined &&
    taskPriorities.includes(task.priority) &&
    Array.isArray(task.tags) &&
    task.tags.every((tag) => taskTags.includes(tag)) &&
    typeof task.createdAt === "string" &&
    typeof task.updatedAt === "string"
  );
}
