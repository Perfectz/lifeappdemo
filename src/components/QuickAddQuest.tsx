"use client";

import { useEffect, useRef, useState } from "react";

import { celebrate } from "@/client/celebrate";
import { openQuickAddEventName } from "@/client/quickAdd";
import { createLocalTaskRepository } from "@/data/taskRepository";
import { toLocalIsoDate } from "@/domain/dates";
import { createTask, taskTags } from "@/domain/tasks";
import type { TaskPriority, TaskTag } from "@/domain";

const PRIORITIES: TaskPriority[] = ["low", "medium", "high"];

export function QuickAddQuest() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [tag, setTag] = useState<TaskTag | "">("");
  const [planToday, setPlanToday] = useState(true);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener(openQuickAddEventName, onOpen);
    return () => window.removeEventListener(openQuickAddEventName, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function reset() {
    setTitle("");
    setPriority("medium");
    setTag("");
    setPlanToday(true);
  }

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    const repo = createLocalTaskRepository(window.localStorage);
    const tasks = repo.load();
    const task = createTask({
      title: trimmed,
      priority,
      tags: tag ? [tag] : [],
      plannedForDate: planToday ? toLocalIsoDate() : undefined
    });
    repo.save([task, ...tasks]);
    celebrate({
      kind: "quest",
      title: "QUEST ADDED",
      subtitle: trimmed,
      pose: "questComplete"
    });
    reset();
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="quick-add-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <form
        className="quick-add"
        role="dialog"
        aria-modal="true"
        aria-label="Quick add quest"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <header className="quick-add-header">
          <p className="eyebrow">New Quest</p>
          <button
            type="button"
            className="quick-add-close"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            ✕
          </button>
        </header>
        <label className="quick-add-field">
          <span className="visually-hidden">Quest title</span>
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What's the next small win?"
            aria-label="Quest title"
            maxLength={140}
          />
        </label>
        <div className="quick-add-row">
          <label className="quick-add-select">
            <span>Priority</span>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as TaskPriority)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="quick-add-select">
            <span>Tag</span>
            <select value={tag} onChange={(event) => setTag(event.target.value as TaskTag | "")}>
              <option value="">none</option>
              {taskTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="quick-add-check">
          <input
            type="checkbox"
            checked={planToday}
            onChange={(event) => setPlanToday(event.target.checked)}
          />
          <span>Plan for today</span>
        </label>
        <div className="quick-add-actions">
          <button type="submit" className="command-button" disabled={!title.trim()}>
            <span>Add Quest</span>
          </button>
        </div>
        <p className="quick-add-hint">Esc to cancel · Enter to add</p>
      </form>
    </div>
  );
}
