"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { SectionHeader } from "@/components/SectionHeader";
import { dataChangedEventName } from "@/data/createLocalRepository";
import { createLocalMemoryRepository } from "@/data/memoryRepository";
import {
  DEFAULT_MEMORY_CATEGORY,
  memoryCategories,
  memoryCategoryLabel,
  memoryCategoryOf,
  removeMemory,
  upsertMemory,
  type MemoryCategory,
  type MemoryEntry
} from "@/domain/memory";

export function MemoryPanel() {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [key, setKey] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<MemoryCategory>(DEFAULT_MEMORY_CATEGORY);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setEntries(createLocalMemoryRepository(window.localStorage).load());
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(dataChangedEventName, reload);
    return () => window.removeEventListener(dataChangedEventName, reload);
  }, [reload]);

  const grouped = useMemo(() => {
    return memoryCategories
      .map((cat) => ({
        category: cat,
        items: entries.filter((entry) => memoryCategoryOf(entry) === cat)
      }))
      .filter((group) => group.items.length > 0);
  }, [entries]);

  function add() {
    if (!key.trim() || !content.trim()) {
      setError("Add a key and content.");
      return;
    }
    try {
      const repo = createLocalMemoryRepository(window.localStorage);
      repo.save(upsertMemory(repo.load(), { key, content, category, source: "user" }));
      setEntries(repo.load());
      setKey("");
      setContent("");
      setCategory(DEFAULT_MEMORY_CATEGORY);
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Couldn't save that memory.");
    }
  }

  function remove(entryKey: string) {
    const repo = createLocalMemoryRepository(window.localStorage);
    repo.save(removeMemory(repo.load(), entryKey));
    setEntries(repo.load());
  }

  return (
    <section className="dashboard-section memory-panel" aria-label="What your coach knows">
      <SectionHeader eyebrow="Memory" title="What your coach knows about you" />
      <p className="reminders-help">
        Your coach fills this in as you talk to it — injuries, meds, conditions, equipment,
        schedule, what works. You don&apos;t have to manage it; just glance here and remove anything
        that&apos;s wrong. Medications, conditions, and injuries are treated as safety ground truth.
      </p>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <details className="memory-add-details">
        <summary>Add something manually</summary>
        <div className="memory-add">
          <input
            className="fitness-input"
            placeholder="Key (e.g. right knee, lisinopril)"
            value={key}
            onChange={(event) => setKey(event.target.value)}
          />
          <select
            className="fitness-input"
            value={category}
            onChange={(event) => setCategory(event.target.value as MemoryCategory)}
            aria-label="Category"
          >
            {memoryCategories.map((cat) => (
              <option key={cat} value={cat}>
                {memoryCategoryLabel[cat]}
              </option>
            ))}
          </select>
          <textarea
            className="wiki-textarea"
            rows={3}
            placeholder="What to remember…"
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
          <button type="button" className="login-submit" onClick={add}>
            <span>Save memory</span>
          </button>
        </div>
      </details>

      {grouped.length > 0 ? (
        grouped.map((group) => (
          <div key={group.category} className="memory-group">
            <h3 className="memory-group-title">{memoryCategoryLabel[group.category]}</h3>
            <ul className="memory-list">
              {group.items.map((entry) => (
                <li className="memory-item" key={entry.id}>
                  <div>
                    <strong>{entry.key}</strong>
                    <span className={`memory-source memory-source-${entry.source}`}>
                      {entry.source}
                    </span>
                    <p>{entry.content}</p>
                  </div>
                  <button
                    type="button"
                    className="memory-remove"
                    aria-label={`Forget ${entry.key}`}
                    onClick={() => remove(entry.key)}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      ) : (
        <p className="reminders-help">
          Nothing yet. Talk to the coach (type or voice) and it&apos;ll start remembering the things
          that matter — no forms required.
        </p>
      )}
    </section>
  );
}
