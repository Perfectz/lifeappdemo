"use client";

import { TaskCard } from "@/components/TaskCard";
import type { Task, TaskInput } from "@/domain";

type TaskGroupProps = {
  emptyMessage: string;
  onArchive: (task: Task) => void;
  onComplete: (task: Task) => void;
  onReopen: (task: Task) => void;
  onUpdate: (task: Task, input: TaskInput) => void;
  tasks: Task[];
  title: string;
  /** "warn" tints the section (used by the Overdue bucket). */
  tone?: "warn";
};

export function TaskGroup({
  emptyMessage,
  onArchive,
  onComplete,
  onReopen,
  onUpdate,
  tasks,
  title,
  tone
}: TaskGroupProps) {
  return (
    <section
      className={tone === "warn" ? "quest-group quest-group-warn" : "quest-group"}
      aria-label={title}
    >
      <div className="quest-group-header">
        <h2>{title}</h2>
        <span className="quest-count-badge" aria-label={`${tasks.length} quests`}>
          {tasks.length}
        </span>
      </div>
      {tasks.length === 0 ? (
        <p className="quest-empty">{emptyMessage}</p>
      ) : (
        <ul className="quest-list">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              onArchive={onArchive}
              onComplete={onComplete}
              onReopen={onReopen}
              onUpdate={onUpdate}
              task={task}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
