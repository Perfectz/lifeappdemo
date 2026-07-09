import type {
  ChecklistItem,
  IsoDate,
  IsoDateTime,
  RecurrenceFrequency,
  Task,
  TaskPriority,
  TaskRecurrence,
  TaskTag
} from "@/domain/types";

export const taskPriorities: TaskPriority[] = ["low", "medium", "high"];
export const taskTags: TaskTag[] = [
  "health",
  "work",
  "content",
  "social",
  "admin",
  "learning"
];
export const recurrenceFrequencies: RecurrenceFrequency[] = [
  "daily",
  "weekdays",
  "weekly",
  "monthly"
];

export type TaskInput = {
  title: string;
  description?: string;
  priority: TaskPriority;
  tags: TaskTag[];
  dueDate?: IsoDate;
  plannedForDate?: IsoDate;
  recurrence?: TaskRecurrence;
  checklist?: ChecklistItem[];
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

function newEntityId(prefix: string, now: IsoDateTime): string {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${now}-${Math.random()}`;
}

/** Drops blank checklist lines; keeps the list undefined when empty. */
function normalizeChecklist(checklist: ChecklistItem[] | undefined): ChecklistItem[] | undefined {
  if (!checklist) {
    return undefined;
  }

  const kept = checklist
    .map((item) => ({ ...item, text: item.text.trim() }))
    .filter((item) => item.text.length > 0);

  return kept.length > 0 ? kept : undefined;
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
      plannedForDate: normalizeOptionalText(input.plannedForDate),
      recurrence: input.recurrence,
      checklist: normalizeChecklist(input.checklist)
    }
  };
}

export function createTask(input: TaskInput, now: IsoDateTime = new Date().toISOString()): Task {
  const validation = validateTaskInput(input);

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  return {
    id: newEntityId("task", now),
    title: validation.value.title,
    description: validation.value.description,
    status: "todo",
    priority: validation.value.priority,
    tags: validation.value.tags,
    dueDate: validation.value.dueDate,
    plannedForDate: validation.value.plannedForDate,
    recurrence: validation.value.recurrence,
    checklist: validation.value.checklist,
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
    // Presence-based: callers that never mention recurrence/checklist (AI
    // tools, voice tools) keep the task's existing values; the quest form
    // always includes the keys so it can clear them intentionally.
    recurrence: "recurrence" in input ? validation.value.recurrence : task.recurrence,
    checklist: "checklist" in input ? validation.value.checklist : task.checklist,
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

/* ----------------------------------------------------------------------------
 * Recurrence
 * ------------------------------------------------------------------------- */

function parseIsoDate(date: IsoDate): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function toIsoDate(utc: Date): IsoDate {
  return utc.toISOString().slice(0, 10);
}

function daysInMonth(year: number, monthIndex: number): number {
  // Day 0 of the next month is the last day of `monthIndex`.
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Today's local calendar date as an IsoDate (device timezone). */
export function localIsoDateToday(now: Date = new Date()): IsoDate {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * The next occurrence strictly after `date` for a repeat frequency.
 * - daily: the next day
 * - weekdays: the next Mon-Fri day (Friday and Saturday roll to Monday)
 * - weekly: same weekday, seven days later
 * - monthly: same day-of-month next month, clamped to the month's last
 *   day (Jan 31 -> Feb 28, or Feb 29 in a leap year)
 */
export function nextOccurrenceDate(date: IsoDate, frequency: RecurrenceFrequency): IsoDate {
  const { year, month, day } = parseIsoDate(date);

  if (frequency === "monthly") {
    const nextMonthIndex = month; // zero-based index of the following month
    const clampedDay = Math.min(day, daysInMonth(year, nextMonthIndex));
    return toIsoDate(new Date(Date.UTC(year, nextMonthIndex, clampedDay)));
  }

  const base = new Date(Date.UTC(year, month - 1, day));

  if (frequency === "weekly") {
    base.setUTCDate(base.getUTCDate() + 7);
    return toIsoDate(base);
  }

  base.setUTCDate(base.getUTCDate() + 1);

  if (frequency === "weekdays") {
    while (base.getUTCDay() === 0 || base.getUTCDay() === 6) {
      base.setUTCDate(base.getUTCDate() + 1);
    }
  }

  return toIsoDate(base);
}

/**
 * Advances `date` occurrence-by-occurrence until it lands strictly after
 * `today`, preserving the rule's anchor (weekly keeps the weekday, monthly
 * keeps the day-of-month) even when the task was completed late.
 */
export function nextOccurrenceAfter(
  date: IsoDate,
  frequency: RecurrenceFrequency,
  today: IsoDate
): IsoDate {
  let next = nextOccurrenceDate(date, frequency);
  // IsoDate strings compare correctly lexicographically. Bounded loop as a
  // guard against pathological data; ~40 years of monthly catch-up is plenty.
  for (let i = 0; i < 500 && next <= today; i += 1) {
    next = nextOccurrenceDate(next, frequency);
  }
  return next;
}

export type CompleteTaskResult = {
  completed: Task;
  /** The freshly spawned next occurrence, when the task repeats. */
  next?: Task;
};

/**
 * The single completion path for every UI surface. Marks the task done and,
 * when it has a repeat rule, spawns the next occurrence: a fresh todo with
 * the same fields, dates advanced past today, and the checklist reset.
 */
export function completeTaskWithRecurrence(
  task: Task,
  now: IsoDateTime = new Date().toISOString(),
  today: IsoDate = localIsoDateToday()
): CompleteTaskResult {
  const completed = completeTask(task, now);

  if (!task.recurrence) {
    return { completed };
  }

  const { frequency } = task.recurrence;

  const next: Task = {
    ...task,
    id: newEntityId("task", now),
    status: "todo",
    completedAt: undefined,
    archivedAt: undefined,
    dueDate: task.dueDate ? nextOccurrenceAfter(task.dueDate, frequency, today) : undefined,
    plannedForDate: task.plannedForDate
      ? nextOccurrenceAfter(task.plannedForDate, frequency, today)
      : undefined,
    checklist: task.checklist?.map((item) => ({
      ...item,
      id: newEntityId("check", now),
      done: false
    })),
    createdAt: now,
    updatedAt: now
  };

  return { completed, next };
}

/* ----------------------------------------------------------------------------
 * Checklist
 * ------------------------------------------------------------------------- */

export function toggleChecklistItem(
  task: Task,
  itemId: string,
  now: IsoDateTime = new Date().toISOString()
): Task {
  if (!task.checklist?.some((item) => item.id === itemId)) {
    return task;
  }

  return {
    ...task,
    checklist: task.checklist.map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    ),
    updatedAt: now
  };
}

export function checklistProgress(task: Task): { done: number; total: number } {
  const total = task.checklist?.length ?? 0;
  const done = task.checklist?.filter((item) => item.done).length ?? 0;
  return { done, total };
}

export function newChecklistItem(text = ""): ChecklistItem {
  return {
    id: newEntityId("check", new Date().toISOString()),
    text,
    done: false
  };
}

/** Maps a stored task back into form/input shape (used by quest edit + checklist toggles). */
export function taskToInput(task: Task): TaskInput {
  return {
    title: task.title,
    description: task.description,
    priority: task.priority,
    tags: task.tags,
    dueDate: task.dueDate,
    plannedForDate: task.plannedForDate,
    recurrence: task.recurrence,
    checklist: task.checklist
  };
}

export function groupTasks(tasks: Task[]): TaskGroups {
  return {
    active: tasks.filter((task) => task.status === "todo"),
    completed: tasks.filter((task) => task.status === "done"),
    archived: tasks.filter((task) => task.status === "archived")
  };
}

function isValidRecurrence(value: Task["recurrence"]): boolean {
  // Optional: tasks stored before recurrence existed must keep loading.
  if (value === undefined) {
    return true;
  }

  return (
    typeof value === "object" &&
    value !== null &&
    recurrenceFrequencies.includes((value as TaskRecurrence).frequency)
  );
}

function isValidChecklist(value: Task["checklist"]): boolean {
  // Optional: tasks stored before checklists existed must keep loading.
  if (value === undefined) {
    return true;
  }

  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" &&
        typeof item.text === "string" &&
        typeof item.done === "boolean"
    )
  );
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
    typeof task.updatedAt === "string" &&
    isValidRecurrence(task.recurrence) &&
    isValidChecklist(task.checklist)
  );
}
