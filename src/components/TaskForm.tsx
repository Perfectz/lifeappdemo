"use client";

import { type FormEvent, useEffect, useState } from "react";

import { dataChangedEventName } from "@/data/createLocalRepository";
import { createLocalGoalRepository } from "@/data/goalRepository";

import type {
  RecurrenceFrequency,
  Goal,
  Task,
  TaskDifficulty,
  TaskInput,
  TaskPriority,
  TaskTag
} from "@/domain";
import {
  newChecklistItem,
  recurrenceFrequencies,
  taskDifficulties,
  taskPriorities,
  taskTags,
  validateTaskInput
} from "@/domain/tasks";

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
  plannedForDate: "",
  recurrence: undefined,
  checklist: [],
  difficulty: "standard",
  linkedGoalId: ""
};

const repeatLabels: Record<RecurrenceFrequency, string> = {
  daily: "Daily",
  weekdays: "Weekdays",
  weekly: "Weekly",
  monthly: "Monthly"
};

/** Labels double as the XP hint so the payoff is visible at capture time. */
const difficultyLabels: Record<TaskDifficulty, string> = {
  quick: "Quick ⚡ (+1 XP)",
  standard: "Standard (+1 XP)",
  hard: "Hard 💀 (+2 XP)",
  epic: "Epic 👑 (+4 XP)"
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
    plannedForDate: task.plannedForDate ?? "",
    recurrence: task.recurrence,
    checklist: task.checklist ?? [],
    difficulty: task.difficulty ?? "standard",
    linkedGoalId: task.linkedGoalId ?? ""
  };
}

export function TaskForm({ buttonLabel, initialTask, onCancel, onSubmit }: TaskFormProps) {
  const [input, setInput] = useState<TaskInput>(() => getInitialInput(initialTask));
  const [error, setError] = useState<string | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    function reloadGoals() {
      setGoals(
        createLocalGoalRepository(window.localStorage)
          .load()
          .filter((goal) => goal.status === "active")
      );
    }
    reloadGoals();
    window.addEventListener(dataChangedEventName, reloadGoals);
    return () => window.removeEventListener(dataChangedEventName, reloadGoals);
  }, []);

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

  function setRepeat(value: string) {
    setField(
      "recurrence",
      value === "none" ? undefined : { frequency: value as RecurrenceFrequency }
    );
  }

  function addChecklistLine() {
    setInput((current) => ({
      ...current,
      checklist: [...(current.checklist ?? []), newChecklistItem()]
    }));
  }

  function setChecklistText(itemId: string, text: string) {
    setInput((current) => ({
      ...current,
      checklist: (current.checklist ?? []).map((item) =>
        item.id === itemId ? { ...item, text } : item
      )
    }));
  }

  function removeChecklistLine(itemId: string) {
    setInput((current) => ({
      ...current,
      checklist: (current.checklist ?? []).filter((item) => item.id !== itemId)
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

  const checklist = input.checklist ?? [];

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
          <span>Difficulty</span>
          <select
            onChange={(event) => setField("difficulty", event.target.value as TaskDifficulty)}
            value={input.difficulty ?? "standard"}
          >
            {taskDifficulties.map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {difficultyLabels[difficulty]}
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
        <label>
          <span>Repeat</span>
          <select
            onChange={(event) => setRepeat(event.target.value)}
            value={input.recurrence?.frequency ?? "none"}
          >
            <option value="none">None</option>
            {recurrenceFrequencies.map((frequency) => (
              <option key={frequency} value={frequency}>
                {repeatLabels[frequency]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Supports Goal</span>
          <select
            onChange={(event) => setField("linkedGoalId", event.target.value)}
            value={input.linkedGoalId ?? ""}
          >
            <option value="">No goal link</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </select>
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
      <fieldset className="checklist-fieldset">
        <legend>Checklist</legend>
        {checklist.length > 0 ? (
          <ul className="checklist-editor">
            {checklist.map((item, index) => (
              <li className="checklist-editor-row" key={item.id}>
                <input
                  aria-label={`Checklist step ${index + 1}`}
                  onChange={(event) => setChecklistText(item.id, event.target.value)}
                  placeholder="Small step"
                  type="text"
                  value={item.text}
                />
                <button
                  aria-label={`Remove checklist step ${index + 1}`}
                  className="checklist-remove"
                  onClick={() => removeChecklistLine(item.id)}
                  type="button"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <button className="checklist-add" onClick={addChecklistLine} type="button">
          + Add step
        </button>
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
