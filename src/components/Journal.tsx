"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { CharacterSprite } from "@/components/CharacterSprite";
import { SectionHeader } from "@/components/SectionHeader";
import { createLocalJournalRepository } from "@/data/journalRepository";
import type { JournalEntry, JournalEntryInput, JournalEntryType } from "@/domain";
import { toLocalIsoDate } from "@/domain/dates";
import {
  createJournalEntry,
  deleteJournalEntry,
  getJournalEntriesForDate,
  getRecentJournalEntries,
  journalEntryTypes,
  journalPrompts,
  updateJournalEntry,
  validateJournalEntryInput
} from "@/domain/journal";

type JournalFormState = {
  date: string;
  type: JournalEntryType;
  prompt: string;
  content: string;
};

const defaultForm = (): JournalFormState => ({
  date: toLocalIsoDate(),
  type: "freeform",
  prompt: "",
  content: ""
});

function toFormInput(form: JournalFormState): JournalEntryInput {
  return {
    date: form.date,
    type: form.type,
    prompt: form.prompt,
    content: form.content
  };
}

function typeLabel(type: JournalEntryType): string {
  return type.replace("_", " ");
}

export function Journal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [form, setForm] = useState<JournalFormState>(() => defaultForm());
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(toLocalIsoDate());
  const [hasLoaded, setHasLoaded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isInitialJournalLoad = useRef(true);
  const entriesForSelectedDate = useMemo(
    () => getJournalEntriesForDate(entries, selectedDate),
    [entries, selectedDate]
  );
  const recentEntries = useMemo(() => getRecentJournalEntries(entries), [entries]);

  useEffect(() => {
    setEntries(createLocalJournalRepository(window.localStorage).load());
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    if (isInitialJournalLoad.current) {
      isInitialJournalLoad.current = false;
      return;
    }

    createLocalJournalRepository(window.localStorage).save(entries);
  }, [entries, hasLoaded]);

  function setField<Key extends keyof JournalFormState>(key: Key, value: JournalFormState[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  function resetForm() {
    setForm(defaultForm());
    setEditingEntryId(null);
    setError(null);
  }

  function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = toFormInput(form);
    const validation = validateJournalEntryInput(input);

    if (!validation.ok) {
      setError(validation.message);
      setMessage(null);
      return;
    }

    setEntries((current) => {
      const existing = editingEntryId
        ? current.find((entry) => entry.id === editingEntryId)
        : undefined;

      if (!existing) {
        return [createJournalEntry(validation.value), ...current];
      }

      return current.map((entry) =>
        entry.id === existing.id ? updateJournalEntry(existing, validation.value) : entry
      );
    });
    setSelectedDate(validation.value.date);
    setMessage(editingEntryId ? "Journal entry updated." : "Journal entry saved.");
    resetForm();
  }

  function startEditing(entry: JournalEntry) {
    setForm({
      date: entry.date,
      type: entry.type,
      prompt: entry.prompt ?? "",
      content: entry.content
    });
    setEditingEntryId(entry.id);
    setMessage(null);
    setError(null);
  }

  function handleDelete(entry: JournalEntry) {
    if (!window.confirm("Delete this journal entry?")) {
      return;
    }

    setEntries((current) => deleteJournalEntry(current, entry.id));
    if (editingEntryId === entry.id) {
      resetForm();
    }
    setMessage("Journal entry deleted.");
    setError(null);
  }

  return (
    <section className="journal-page" aria-labelledby="journal-title">
      <header className="journal-hero">
        <div>
          <p className="eyebrow">Lesson Capture</p>
          <h1 id="journal-title">Journal</h1>
          <p>Capture lessons, reflections, and public-shareable raw material.</p>
        </div>
        <div className="page-sprite-frame journal-sprite" aria-hidden="true">
          <CharacterSprite className="page-sprite" pose="thinking" />
        </div>
      </header>

      {message ? (
        <p className="standup-success" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="journal-layout">
        <section className="dashboard-section" aria-label="Journal entry form">
          <SectionHeader
            eyebrow="Capture"
            title={editingEntryId ? "Edit Journal Entry" : "New Journal Entry"}
          />
          <form className="journal-form" onSubmit={saveEntry}>
            <div className="journal-form-row">
              <label>
                <span>Date</span>
                <input
                  onChange={(event) => setField("date", event.target.value)}
                  onInput={(event) => setField("date", event.currentTarget.value)}
                  type="date"
                  value={form.date}
                />
              </label>
              <label>
                <span>Entry type</span>
                <select
                  onChange={(event) => setField("type", event.target.value as JournalEntryType)}
                  value={form.type}
                >
                  {journalEntryTypes.map((type) => (
                    <option key={type} value={type}>
                      {typeLabel(type)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              <span>Prompt</span>
              <select
                onChange={(event) => setField("prompt", event.target.value)}
                value={form.prompt}
              >
                <option value="">No prompt</option>
                {journalPrompts.map((prompt) => (
                  <option key={prompt} value={prompt}>
                    {prompt}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Content</span>
              <textarea
                onChange={(event) => setField("content", event.target.value)}
                placeholder="Capture the useful truth while it is fresh."
                value={form.content}
              />
            </label>

            <div className="journal-form-actions">
              <button type="submit">
                {editingEntryId ? "Save Journal Edit" : "Save Journal Entry"}
              </button>
              {editingEntryId ? (
                <button onClick={resetForm} type="button">
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <aside className="journal-side">
          <section className="dashboard-section" aria-label="Journal date filter">
            <SectionHeader eyebrow="Filter" title="Entries By Date" />
            <label className="journal-date-filter">
              <span>Selected date</span>
              <input
                onChange={(event) => setSelectedDate(event.target.value)}
                onInput={(event) => setSelectedDate(event.currentTarget.value)}
                type="date"
                value={selectedDate}
              />
            </label>
            <p className="quest-empty">
              {entriesForSelectedDate.length} entr
              {entriesForSelectedDate.length === 1 ? "y" : "ies"} on selected date.
            </p>
          </section>

          <section className="dashboard-section" aria-label="Recent journal entries">
            <SectionHeader eyebrow="Recent" title="Journal Entries" />
            {!hasLoaded ? <p className="quest-empty">Loading journal...</p> : null}
            {hasLoaded && recentEntries.length === 0 ? (
              <p className="quest-empty">No journal entries yet.</p>
            ) : null}
            <div className="journal-entry-list">
              {recentEntries.map((entry) => (
                <article
                  className={
                    entry.date === selectedDate
                      ? "journal-entry-card journal-entry-card-selected"
                      : "journal-entry-card"
                  }
                  key={entry.id}
                >
                  <div>
                    <h3>{typeLabel(entry.type)}</h3>
                    <p className="journal-entry-meta">{entry.date}</p>
                    {entry.prompt ? <p className="journal-entry-prompt">{entry.prompt}</p> : null}
                    <p>{entry.content}</p>
                  </div>
                  <div className="journal-entry-actions">
                    <button onClick={() => startEditing(entry)} type="button">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(entry)} type="button">
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
