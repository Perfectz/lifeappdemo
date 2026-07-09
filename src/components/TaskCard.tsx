"use client";

import { useState } from "react";

import { TaskForm } from "@/components/TaskForm";
import type { Task, TaskInput } from "@/domain";
import { checklistProgress, taskToInput } from "@/domain/tasks";

type TaskCardProps = {
  onArchive: (task: Task) => void;
  onComplete: (task: Task) => void;
  onReopen: (task: Task) => void;
  onUpdate: (task: Task, input: TaskInput) => void;
  task: Task;
};

const repeatLabels: Record<string, string> = {
  daily: "Daily",
  weekdays: "Weekdays",
  weekly: "Weekly",
  monthly: "Monthly"
};

export function TaskCard({
  onArchive,
  onComplete,
  onReopen,
  onUpdate,
  task
}: TaskCardProps) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <li className="quest-card quest-card-editing">
        <TaskForm
          buttonLabel="Save Quest"
          initialTask={task}
          onCancel={() => setIsEditing(false)}
          onSubmit={(input) => {
            onUpdate(task, input);
            setIsEditing(false);
          }}
        />
      </li>
    );
  }

  const progress = checklistProgress(task);

  function toggleChecklistItem(itemId: string) {
    const checklist = (task.checklist ?? []).map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );
    // Persist through the normal update path so every consumer sees it.
    onUpdate(task, { ...taskToInput(task), checklist });
  }

  return (
    <li className="quest-card">
      <div>
        <div className="quest-card-heading">
          <h3>
            <span className={`priority-gem priority-gem-${task.priority}`} aria-hidden="true" />
            {task.title}
          </h3>
          <div className="quest-card-badges">
            {progress.total > 0 ? (
              <span
                className="checklist-progress"
                aria-label={`${progress.done} of ${progress.total} steps done`}
              >
                {progress.done}/{progress.total}
              </span>
            ) : null}
            {task.recurrence ? (
              <span
                className="recurrence-badge"
                title={`Repeats ${repeatLabels[task.recurrence.frequency].toLowerCase()}`}
              >
                <span aria-hidden="true">↻</span> {repeatLabels[task.recurrence.frequency]}
              </span>
            ) : null}
            <span className={`priority-badge priority-${task.priority}`}>
              {task.priority}
            </span>
          </div>
        </div>
        {task.description ? <p>{task.description}</p> : null}
        {task.checklist && task.checklist.length > 0 ? (
          <ul className="quest-checklist" aria-label={`${task.title} checklist`}>
            {task.checklist.map((item) => (
              <li key={item.id}>
                <label className={item.done ? "quest-checklist-done" : undefined}>
                  <input
                    checked={item.done}
                    onChange={() => toggleChecklistItem(item.id)}
                    type="checkbox"
                  />
                  <span>{item.text}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : null}
        <dl className="quest-meta">
          {task.dueDate ? (
            <div>
              <dt>Due</dt>
              <dd>{task.dueDate}</dd>
            </div>
          ) : null}
          {task.plannedForDate ? (
            <div>
              <dt>Planned</dt>
              <dd>{task.plannedForDate}</dd>
            </div>
          ) : null}
          {task.completedAt ? (
            <div>
              <dt>Cleared</dt>
              <dd>{new Date(task.completedAt).toLocaleDateString()}</dd>
            </div>
          ) : null}
          {task.archivedAt ? (
            <div>
              <dt>Archived</dt>
              <dd>{new Date(task.archivedAt).toLocaleDateString()}</dd>
            </div>
          ) : null}
        </dl>
        {task.tags.length > 0 ? (
          <div className="quest-tags" aria-label="Quest tags">
            {task.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="quest-actions">
        <button className="quest-action-secondary" onClick={() => setIsEditing(true)} type="button">
          Edit
        </button>
        {task.status === "todo" ? (
          <button className="quest-action-primary" onClick={() => onComplete(task)} type="button">
            Complete
          </button>
        ) : null}
        {task.status === "done" ? (
          <button className="quest-action-primary" onClick={() => onReopen(task)} type="button">
            Reopen
          </button>
        ) : null}
        {task.status !== "archived" ? (
          <button className="quest-action-danger" onClick={() => onArchive(task)} type="button">
            Archive
          </button>
        ) : null}
      </div>
    </li>
  );
}
