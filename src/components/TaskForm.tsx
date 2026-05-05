"use client";

import { type FormEvent, useState } from "react";

import type { Task, TaskInput, TaskPriority, TaskTag } from "@/domain";
import { taskPriorities, taskTags, validateTaskInput } from "@/domain/tasks";

type TaskFormProps = {
  buttonLabel: string;
  initialTask?: Task;
  onCancel?: () => void;
  onSubmit: (input: TaskInput) => void;
};

const defaultInput: TaskInput = {
  title: "",
  description: "",
  priority: "medium",
  tags: [],
  dueDate: "",
  plannedForDate: ""
};

function getInitialInput(task?: Task): TaskInput {
  if (!task) {
    return defaultInput;
  }

  return {
    title: task.title,
    description: task.description ?? "",
    priority: task.priority,
    tags: task.tags,
    dueDate: task.dueDate ?? "",
    plannedForDate: task.plannedForDate ?? ""
  };
}

export function TaskForm({ buttonLabel, initialTask, onCancel, onSubmit }: TaskFormProps) {
  const [input, setInput] = useState<TaskInput>(() => getInitialInput(initialTask));
  const [error, setError] = useState<string | null>(null);

  function setField<Key extends keyof TaskInput>(key: Key, value: TaskInput[Key]) {
    setInput((current) => ({
      ...current,
      [key]: value
    }));
  }

  function toggleTag(tag: TaskTag) {
    setInput((current) => ({
      ...current,
      tags: current.tags.includes(tag)
        ? current.tags.filter((item) => item !== tag)
        : [...current.tags, tag]
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateTaskInput(input);

    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    onSubmit(validation.value);
    setError(null);

    if (!initialTask) {
      setInput(defaultInput);
    }
  }

  return (
    <form className="quest-form" onSubmit={handleSubmit}>
      <label>
        <span>Quest Title</span>
        <input
          aria-describedby={error ? "task-title-error" : undefined}
          onChange={(event) => setField("title", event.target.value)}
          placeholder="Add one small win"
          type="text"
          value={input.title}
        />
      </label>
      {error ? (
        <p className="form-error" id="task-title-error" role="alert">
          {error}
        </p>
      ) : null}
      <label>
        <span>Description</span>
        <textarea
          onChange={(event) => setField("description", event.target.value)}
          placeholder="Optional quest note"
          value={input.description}
        />
      </label>
      <div className="quest-form-row">
        <label>
          <span>Priority</span>
          <select
            onChange={(event) => setField("priority", event.target.value as TaskPriority)}
            value={input.priority}
          >
            {taskPriorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Due Date</span>
          <input
            onChange={(event) => setField("dueDate", event.target.value)}
            type="date"
            value={input.dueDate}
          />
        </label>
        <label>
          <span>Planned Date</span>
          <input
            onChange={(event) => setField("plannedForDate", event.target.value)}
            type="date"
            value={input.plannedForDate}
          />
        </label>
      </div>
      <fieldset className="tag-fieldset">
        <legend>Tags</legend>
        <div className="tag-options">
          {taskTags.map((tag) => (
            <label className="tag-option" key={tag}>
              <input
                checked={input.tags.includes(tag)}
                onChange={() => toggleTag(tag)}
                type="checkbox"
              />
              <span>{tag}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="quest-form-actions">
        <button type="submit">{buttonLabel}</button>
        {onCancel ? (
          <button onClick={onCancel} type="button">
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
