"use client";

import { useState } from "react";

import { TaskForm } from "@/components/TaskForm";
import type { Task, TaskInput } from "@/domain";

type TaskCardProps = {
  onArchive: (task: Task) => void;
  onComplete: (task: Task) => void;
  onReopen: (task: Task) => void;
  onUpdate: (task: Task, input: TaskInput) => void;
  task: Task;
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

  return (
    <li className="quest-card">
      <div>
        <div className="quest-card-heading">
          <h3>
            <span className={`priority-gem priority-gem-${task.priority}`} aria-hidden="true" />
            {task.title}
          </h3>
          <span className={`priority-badge priority-${task.priority}`}>
            {task.priority}
          </span>
        </div>
        {task.description ? <p>{task.description}</p> : null}
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
