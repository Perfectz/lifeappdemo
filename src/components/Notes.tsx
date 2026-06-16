"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { CharacterSprite } from "@/components/CharacterSprite";
import { SectionHeader } from "@/components/SectionHeader";
import { createLocalNoteRepository } from "@/data/noteRepository";
import type { Note, NoteInput } from "@/domain";
import {
  createNote,
  deleteNote,
  formatNoteTags,
  parseNoteTags,
  searchNotes,
  updateNote,
  validateNoteInput
} from "@/domain/notes";

type NoteFormState = {
  title: string;
  content: string;
  tags: string;
};

const defaultForm = (): NoteFormState => ({
  title: "",
  content: "",
  tags: ""
});

function toNoteInput(form: NoteFormState): NoteInput {
  return {
    title: form.title,
    content: form.content,
    tags: parseNoteTags(form.tags)
  };
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [form, setForm] = useState<NoteFormState>(() => defaultForm());
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isInitialNotesLoad = useRef(true);
  const visibleNotes = useMemo(() => searchNotes(notes, query), [notes, query]);

  useEffect(() => {
    setNotes(createLocalNoteRepository(window.localStorage).load());
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    if (isInitialNotesLoad.current) {
      isInitialNotesLoad.current = false;
      return;
    }

    createLocalNoteRepository(window.localStorage).save(notes);
  }, [notes, hasLoaded]);

  function setField<Key extends keyof NoteFormState>(key: Key, value: NoteFormState[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  function resetForm() {
    setForm(defaultForm());
    setEditingNoteId(null);
    setError(null);
  }

  function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = toNoteInput(form);
    const validation = validateNoteInput(input);

    if (!validation.ok) {
      setError(validation.message);
      setMessage(null);
      return;
    }

    setNotes((current) => {
      const existing = editingNoteId
        ? current.find((note) => note.id === editingNoteId)
        : undefined;

      if (!existing) {
        return [createNote(validation.value), ...current];
      }

      return current.map((note) =>
        note.id === existing.id ? updateNote(existing, validation.value) : note
      );
    });
    setMessage(editingNoteId ? "Note updated." : "Note saved.");
    resetForm();
  }

  function startEditing(note: Note) {
    setForm({
      title: note.title,
      content: note.content,
      tags: formatNoteTags(note.tags)
    });
    setEditingNoteId(note.id);
    setMessage(null);
    setError(null);
  }

  function handleDelete(note: Note) {
    if (!window.confirm("Delete this note?")) {
      return;
    }

    setNotes((current) => deleteNote(current, note.id));
    if (editingNoteId === note.id) {
      resetForm();
    }
    setMessage("Note deleted.");
    setError(null);
  }

  return (
    <section className="notes-page" aria-labelledby="notes-title">
      <header className="notes-hero">
        <div>
          <p className="eyebrow">Field Notes</p>
          <h1 id="notes-title">Notes</h1>
          <p>Keep fast private notes, ideas, and scratch plans without turning them into quests.</p>
        </div>
        <div className="page-sprite-frame notes-sprite" aria-hidden="true">
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

      <div className="notes-layout">
        <section className="dashboard-section" aria-label="Note form">
          <SectionHeader eyebrow="Capture" title={editingNoteId ? "Edit Note" : "New Note"} />
          <form className="notes-form" onSubmit={saveNote}>
            <label>
              <span>Title</span>
              <input
                onChange={(event) => setField("title", event.target.value)}
                placeholder="Quick title"
                type="text"
                value={form.title}
              />
            </label>

            <label>
              <span>Tags</span>
              <input
                onChange={(event) => setField("tags", event.target.value)}
                placeholder="planning, health, idea"
                type="text"
                value={form.tags}
              />
            </label>

            <label>
              <span>Note</span>
              <textarea
                onChange={(event) => setField("content", event.target.value)}
                placeholder="Write the useful detail while it is fresh."
                value={form.content}
              />
            </label>

            <div className="notes-form-actions">
              <button type="submit">
                {editingNoteId ? "Save Note Edit" : "Save Note"}
              </button>
              {editingNoteId ? (
                <button onClick={resetForm} type="button">
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <aside className="notes-side">
          <section className="dashboard-section" aria-label="Search notes">
            <SectionHeader eyebrow="Find" title="Search Notes" />
            <label className="notes-search">
              <span>Search</span>
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title, body, or tag"
                type="search"
                value={query}
              />
            </label>
            <p className="quest-empty">
              {visibleNotes.length} note{visibleNotes.length === 1 ? "" : "s"} shown.
            </p>
          </section>

          <section className="dashboard-section" aria-label="Saved notes">
            <SectionHeader eyebrow="Archive" title="Saved Notes" />
            {!hasLoaded ? <p className="quest-empty">Loading notes...</p> : null}
            {hasLoaded && notes.length === 0 ? (
              <p className="quest-empty">No notes yet.</p>
            ) : null}
            {hasLoaded && notes.length > 0 && visibleNotes.length === 0 ? (
              <p className="quest-empty">No notes match that search.</p>
            ) : null}
            <div className="notes-entry-list">
              {visibleNotes.map((note) => (
                <article className="notes-entry-card" key={note.id}>
                  <div>
                    <h3>{note.title}</h3>
                    <p className="notes-entry-meta">Updated {formatUpdatedAt(note.updatedAt)}</p>
                    {note.tags.length > 0 ? (
                      <ul className="notes-tag-list" aria-label={`Tags for ${note.title}`}>
                        {note.tags.map((tag) => (
                          <li key={tag}>{tag}</li>
                        ))}
                      </ul>
                    ) : null}
                    <p>{note.content}</p>
                  </div>
                  <div className="notes-entry-actions">
                    <button onClick={() => startEditing(note)} type="button">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(note)} type="button">
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
