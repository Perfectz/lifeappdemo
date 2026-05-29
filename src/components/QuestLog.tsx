"use client";

import { useEffect, useMemo, useState } from "react";

import { celebrate } from "@/client/celebrate";
import { openQuickAdd } from "@/client/quickAdd";
import { CharacterSprite } from "@/components/CharacterSprite";
import { StatusPanel } from "@/components/StatusPanel";
import { TaskForm } from "@/components/TaskForm";
import { TaskGroup } from "@/components/TaskGroup";
import { createLocalTaskRepository } from "@/data/taskRepository";
import type { Task, TaskInput } from "@/domain";
import {
  archiveTask,
  completeTask,
  createTask,
  groupTasks,
  reopenTask,
  updateTask
} from "@/domain/tasks";

function replaceTask(tasks: Task[], updatedTask: Task): Task[] {
  return tasks.map((task) => (task.id === updatedTask.id ? updatedTask : task));
}

export function QuestLog() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const repository = createLocalTaskRepository(window.localStorage);
    setTasks(repository.load());
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    createLocalTaskRepository(window.localStorage).save(tasks);
  }, [hasLoaded, tasks]);

  const groups = useMemo(() => groupTasks(tasks), [tasks]);

  function addTask(input: TaskInput) {
    setTasks((current) => [createTask(input), ...current]);
  }

  function handleUpdate(task: Task, input: TaskInput) {
    setTasks((current) => replaceTask(current, updateTask(task, input)));
  }

  function handleComplete(task: Task) {
    setTasks((current) => replaceTask(current, completeTask(task)));
    celebrate({
      kind: "quest",
      title: "QUEST COMPLETE!",
      subtitle: task.title,
      pose: "questComplete"
    });
  }

  function handleReopen(task: Task) {
    setTasks((current) => replaceTask(current, reopenTask(task)));
  }

  function handleArchive(task: Task) {
    setTasks((current) => replaceTask(current, archiveTask(task)));
  }

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
        <StatusPanel label="Active" tone="success" value={String(groups.active.length)} />
        <StatusPanel label="Cleared" tone="warning" value={String(groups.completed.length)} />
        <StatusPanel label="Archived" value={String(groups.archived.length)} />
      </section>
      <div className="quest-log-grid">
        <section className="quest-create-panel" aria-labelledby="new-quest-heading">
          <h2 id="new-quest-heading">New Quest</h2>
          <TaskForm buttonLabel="Add Quest" onSubmit={addTask} />
        </section>
        <div className="quest-groups">
          {!hasLoaded ? <p className="quest-empty">Loading Quest Log...</p> : null}
          {hasLoaded && tasks.length === 0 ? (
            <div className="quest-empty quest-empty-global quest-empty-cta">
              <p>Your quest log is empty. Capture one small win to begin.</p>
              <button type="button" className="command-button" onClick={() => openQuickAdd()}>
                <span>Quick add a quest</span>
              </button>
            </div>
          ) : null}
          <TaskGroup
            emptyMessage="No active quests."
            onArchive={handleArchive}
            onComplete={handleComplete}
            onReopen={handleReopen}
            onUpdate={handleUpdate}
            tasks={groups.active}
            title="Active Quests"
          />
          <TaskGroup
            emptyMessage="No cleared quests."
            onArchive={handleArchive}
            onComplete={handleComplete}
            onReopen={handleReopen}
            onUpdate={handleUpdate}
            tasks={groups.completed}
            title="Cleared Quests"
          />
          <TaskGroup
            emptyMessage="No archived quests."
            onArchive={handleArchive}
            onComplete={handleComplete}
            onReopen={handleReopen}
            onUpdate={handleUpdate}
            tasks={groups.archived}
            title="Archived"
          />
        </div>
      </div>
    </section>
  );
}
