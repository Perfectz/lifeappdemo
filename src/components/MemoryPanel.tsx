"use client";

import { useCallback, useEffect, useState } from "react";

import { SectionHeader } from "@/components/SectionHeader";
import { dataChangedEventName } from "@/data/createLocalRepository";
import { createLocalMemoryRepository } from "@/data/memoryRepository";
import { removeMemory, upsertMemory, type MemoryEntry } from "@/domain/memory";

export function MemoryPanel() {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [key, setKey] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setEntries(createLocalMemoryRepository(window.localStorage).load());
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(dataChangedEventName, reload);
    return () => window.removeEventListener(dataChangedEventName, reload);
  }, [reload]);

  function add() {
    if (!key.trim() || !content.trim()) {
      setError("Add a key and content.");
      return;
    }
    try {
      const repo = createLocalMemoryRepository(window.localStorage);
      repo.save(upsertMemory(repo.load(), { key, content, source: "user" }));
      setEntries(repo.load());
      setKey("");
      setContent("");
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
    <section className="dashboard-section memory-panel" aria-label="Agent memory">
      <SectionHeader eyebrow="Memory" title="What the agent remembers" />
      <p className="reminders-help">
        Durable facts the AI can recall and update across sessions — resume, favorite workouts,
        preferences, anything. The coach and voice agent read these and can add their own.
      </p>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="memory-add">
        <input
          className="fitness-input"
          placeholder="Key (e.g. resume, favorite workouts)"
          value={key}
          onChange={(event) => setKey(event.target.value)}
        />
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

      {entries.length > 0 ? (
        <ul className="memory-list">
          {entries.map((entry) => (
            <li className="memory-item" key={entry.id}>
              <div>
                <strong>{entry.key}</strong>
                <span className={`memory-source memory-source-${entry.source}`}>{entry.source}</span>
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
      ) : (
        <p className="reminders-help">No memories yet. Add one above, or ask the coach/voice agent to remember something.</p>
      )}
    </section>
  );
}
