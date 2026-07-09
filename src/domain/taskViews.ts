import type { IsoDate, Task, TaskPriority, TaskTag } from "@/domain/types";

/**
 * Date-aware view model for the Active quest list plus the local
 * search/filter state used above it. Pure functions only — the Quest Log
 * memoizes these over the loaded task list.
 */

export type ActiveBucketId = "overdue" | "today" | "upcoming" | "someday";

export type ActiveBuckets = {
  overdue: Task[];
  today: Task[];
  upcoming: Task[];
  someday: Task[];
};

export const activeBucketOrder: ActiveBucketId[] = [
  "overdue",
  "today",
  "upcoming",
  "someday"
];

/**
 * Bucket rules for an active (todo) task relative to `today`:
 * - overdue: dueDate strictly before today
 * - today: due today, planned today, or planned for a past day with no
 *   due date (a carried-over plan is still actionable now)
 * - upcoming: any remaining future due/planned date
 * - someday: no dates at all
 */
export function bucketForTask(task: Task, today: IsoDate): ActiveBucketId {
  if (task.dueDate && task.dueDate < today) {
    return "overdue";
  }

  if (task.dueDate === today || (task.plannedForDate && task.plannedForDate <= today)) {
    return "today";
  }

  if (task.dueDate || task.plannedForDate) {
    return "upcoming";
  }

  return "someday";
}

const priorityRank: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2
};

/** Priority (high -> low), then earliest due date (undated last), then planned date, then creation. */
export function compareActiveTasks(a: Task, b: Task): number {
  const byPriority = priorityRank[a.priority] - priorityRank[b.priority];
  if (byPriority !== 0) {
    return byPriority;
  }

  const aDue = a.dueDate ?? "9999-12-31";
  const bDue = b.dueDate ?? "9999-12-31";
  if (aDue !== bDue) {
    return aDue < bDue ? -1 : 1;
  }

  const aPlanned = a.plannedForDate ?? "9999-12-31";
  const bPlanned = b.plannedForDate ?? "9999-12-31";
  if (aPlanned !== bPlanned) {
    return aPlanned < bPlanned ? -1 : 1;
  }

  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

export function groupActiveTasks(tasks: Task[], today: IsoDate): ActiveBuckets {
  const buckets: ActiveBuckets = {
    overdue: [],
    today: [],
    upcoming: [],
    someday: []
  };

  for (const task of tasks) {
    buckets[bucketForTask(task, today)].push(task);
  }

  for (const id of activeBucketOrder) {
    buckets[id].sort(compareActiveTasks);
  }

  return buckets;
}

/* ----------------------------------------------------------------------------
 * Search + filter (combined with AND semantics)
 * ------------------------------------------------------------------------- */

export type TaskFilters = {
  search: string;
  tags: TaskTag[];
  priorities: TaskPriority[];
};

export const emptyTaskFilters: TaskFilters = {
  search: "",
  tags: [],
  priorities: []
};

export function hasActiveFilters(filters: TaskFilters): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.tags.length > 0 ||
    filters.priorities.length > 0
  );
}

function matchesSearch(task: Task, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) {
    return true;
  }

  return (
    task.title.toLowerCase().includes(query) ||
    (task.description?.toLowerCase().includes(query) ?? false)
  );
}

function matchesTags(task: Task, tags: TaskTag[]): boolean {
  return tags.length === 0 || tags.some((tag) => task.tags.includes(tag));
}

function matchesPriorities(task: Task, priorities: TaskPriority[]): boolean {
  return priorities.length === 0 || priorities.includes(task.priority);
}

/**
 * Filters combine with AND across kinds (search AND tags AND priority);
 * multiple chips within one kind widen the match (OR).
 */
export function filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
  if (!hasActiveFilters(filters)) {
    return tasks;
  }

  return tasks.filter(
    (task) =>
      matchesSearch(task, filters.search) &&
      matchesTags(task, filters.tags) &&
      matchesPriorities(task, filters.priorities)
  );
}
