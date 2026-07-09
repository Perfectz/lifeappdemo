"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { celebrate } from "@/client/celebrate";
import { openQuickAdd } from "@/client/quickAdd";
import { CharacterSprite } from "@/components/CharacterSprite";
import { StatusPanel } from "@/components/StatusPanel";
import { TaskForm } from "@/components/TaskForm";
import { TaskGroup } from "@/components/TaskGroup";
import { dataChangedEventName } from "@/data/createLocalRepository";
import { createLocalTaskRepository } from "@/data/taskRepository";
import type { Task, TaskInput, TaskPriority, TaskTag } from "@/domain";
import {
  archiveTask,
  completeTaskWithRecurrence,
  createTask,
  groupTasks,
  localIsoDateToday,
  reopenTask,
  taskPriorities,
  taskTags,
  updateTask
} from "@/domain/tasks";
import {
  emptyTaskFilters,
  filterTasks,
  groupActiveTasks,
  hasActiveFilters,
  type TaskFilters
} from "@/domain/taskViews";

function replaceTask(tasks: Task[], updatedTask: Task): Task[] {
  return tasks.map((task) => (task.id === updatedTask.id ? updatedTask : task));
}

function toggleListItem<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];
}

export function QuestLog() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  // Local-only filter state: intentionally resets on navigation.
  const [filters, setFilters] = useState<TaskFilters>(emptyTaskFilters);

  const reload = useCallback(() => {
    setTasks(createLocalTaskRepository(window.localStorage).load());
  }, []);

  // Stay live with external writers (coach suggestions panel, voice agent,
  // AI tools): every repository save dispatches dataChangedEventName.
  useEffect(() => {
    reload();
    setHasLoaded(true);
    window.addEventListener(dataChangedEventName, reload);
    return () => window.removeEventListener(dataChangedEventName, reload);
  }, [reload]);

  // Read-modify-write against storage so a save never clobbers tasks that
  // another surface appended after our last load.
  function persist(mutate: (current: Task[]) => Task[]) {
    const repository = createLocalTaskRepository(window.localStorage);
    repository.save(mutate(repository.load()));
    setTasks(repository.load());
  }

  const filtering = hasActiveFilters(filters);
  const filteredTasks = useMemo(() => filterTasks(tasks, filters), [tasks, filters]);
  const groups = useMemo(() => groupTasks(filteredTasks), [filteredTasks]);
  const allGroups = useMemo(() => groupTasks(tasks), [tasks]);
  const today = localIsoDateToday();
  const activeBuckets = useMemo(
    () => groupActiveTasks(groups.active, today),
    [groups.active, today]
  );

  function addTask(input: TaskInput) {
    persist((current) => [createTask(input), ...current]);
  }

  function handleUpdate(task: Task, input: TaskInput) {
    persist((current) => replaceTask(current, updateTask(task, input)));
  }

  function handleComplete(task: Task) {
    const { completed, next } = completeTaskWithRecurrence(task);
    persist((current) => {
      const replaced = replaceTask(current, completed);
      return next ? [next, ...replaced] : replaced;
    });
    celebrate({
      kind: "quest",
      title: "QUEST COMPLETE!",
      subtitle: task.title,
      pose: "questComplete"
    });
  }

  function handleReopen(task: Task) {
    persist((current) => replaceTask(current, reopenTask(task)));
  }

  function handleArchive(task: Task) {
    persist((current) => replaceTask(current, archiveTask(task)));
  }

  const groupHandlers = {
    onArchive: handleArchive,
    onComplete: handleComplete,
    onReopen: handleReopen,
    onUpdate: handleUpdate
  };

  const activeSections = [
    {
      key: "overdue",
      title: "Overdue",
      tasks: activeBuckets.overdue,
      emptyMessage: "Nothing overdue.",
      tone: "warn" as const
    },
    {
      key: "today",
      title: "Today",
      tasks: activeBuckets.today,
      emptyMessage: "Nothing due or planned today.",
      tone: undefined
    },
    {
      key: "upcoming",
      title: "Upcoming",
      tasks: activeBuckets.upcoming,
      emptyMessage: "No upcoming quests.",
      tone: undefined
    },
    {
      key: "someday",
      title: "Someday",
      tasks: activeBuckets.someday,
      emptyMessage: "No someday quests.",
      tone: undefined
    }
  ];

  const hasActiveQuests = groups.active.length > 0;

  return (
    <section className="quest-log-page" aria-labelledby="quest-log-title">
      <div className="quest-log-hero">
        <div>
          <p className="eyebrow">Quest Log</p>
          <h1 id="quest-log-title">Quest Log</h1>
          <p>
            Capture the next small win, clear it, reopen it when needed, or
            archive it when the quest leaves the board.
          </p>
        </div>
        <div className="page-sprite-frame quest-log-sprite" aria-hidden="true">
          <CharacterSprite className="page-sprite" pose="questComplete" />
        </div>
      </div>
      <section className="dashboard-grid quest-log-summary" aria-label="Quest board summary">
        <StatusPanel label="Active" tone="success" value={String(allGroups.active.length)} />
        <StatusPanel label="Cleared" tone="warning" value={String(allGroups.completed.length)} />
        <StatusPanel label="Archived" value={String(allGroups.archived.length)} />
      </section>
      <div className="quest-log-grid">
        <section className="quest-create-panel" aria-labelledby="new-quest-heading">
          <h2 id="new-quest-heading">New Quest</h2>
          <TaskForm buttonLabel="Add Quest" onSubmit={addTask} />
        </section>
        <div className="quest-groups">
          <section className="quest-filter-bar" aria-label="Search and filter quests">
            <label className="quest-search">
              <span>Search quests</span>
              <input
                onChange={(event) =>
                  setFilters((current) => ({ ...current, search: event.target.value }))
                }
                placeholder="Search title or description"
                type="search"
                value={filters.search}
              />
            </label>
            <div className="quest-filter-chips" role="group" aria-label="Filter by tag">
              {taskTags.map((tag) => (
                <button
                  aria-pressed={filters.tags.includes(tag)}
                  className={
                    filters.tags.includes(tag)
                      ? "quest-filter-chip quest-filter-chip-active"
                      : "quest-filter-chip"
                  }
                  key={tag}
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      tags: toggleListItem<TaskTag>(current.tags, tag)
                    }))
                  }
                  type="button"
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="quest-filter-chips" role="group" aria-label="Filter by priority">
              {taskPriorities.map((priority) => (
                <button
                  aria-pressed={filters.priorities.includes(priority)}
                  className={
                    filters.priorities.includes(priority)
                      ? "quest-filter-chip quest-filter-chip-active"
                      : "quest-filter-chip"
                  }
                  key={priority}
                  onClick={() =>
                    setFilters((current) => ({
                      ...current,
                      priorities: toggleListItem<TaskPriority>(current.priorities, priority)
                    }))
                  }
                  type="button"
                >
                  {priority}
                </button>
              ))}
            </div>
            {filtering ? (
              <p className="quest-filter-summary" role="status">
                {filteredTasks.length} of {tasks.length} quests
                <button
                  className="quest-filter-clear"
                  onClick={() => setFilters(emptyTaskFilters)}
                  type="button"
                >
                  Clear filters
                </button>
              </p>
            ) : null}
          </section>
          {!hasLoaded ? <p className="quest-empty">Loading Quest Log...</p> : null}
          {hasLoaded && tasks.length === 0 ? (
            <div className="quest-empty quest-empty-global quest-empty-cta">
              <p>Your quest log is empty. Capture one small win to begin.</p>
              <button type="button" className="command-button" onClick={() => openQuickAdd()}>
                <span>Quick add a quest</span>
              </button>
            </div>
          ) : null}
          {hasLoaded && !hasActiveQuests ? (
            <section className="quest-group" aria-label="Active Quests">
              <div className="quest-group-header">
                <h2>Active Quests</h2>
                <span className="quest-count-badge" aria-label="0 quests">
                  0
                </span>
              </div>
              <p className="quest-empty">
                {filtering ? "No active quests match your filters." : "No active quests."}
              </p>
            </section>
          ) : null}
          {activeSections.map((section) =>
            section.tasks.length > 0 ? (
              <TaskGroup
                emptyMessage={section.emptyMessage}
                key={section.key}
                {...groupHandlers}
                tasks={section.tasks}
                title={section.title}
                tone={section.tone}
              />
            ) : null
          )}
          <TaskGroup
            emptyMessage={
              filtering ? "No cleared quests match your filters." : "No cleared quests."
            }
            {...groupHandlers}
            tasks={groups.completed}
            title="Cleared Quests"
          />
          <TaskGroup
            emptyMessage={
              filtering ? "No archived quests match your filters." : "No archived quests."
            }
            {...groupHandlers}
            tasks={groups.archived}
            title="Archived"
          />
        </div>
      </div>
    </section>
  );
}
