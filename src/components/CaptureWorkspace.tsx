"use client";

import Link from "next/link";
import { useState } from "react";

import { createLocalJournalRepository } from "@/data/journalRepository";
import { createLocalNoteRepository } from "@/data/noteRepository";
import { createLocalTaskRepository } from "@/data/taskRepository";
import { toLocalIsoDate } from "@/domain/dates";
import { createJournalEntry } from "@/domain/journal";
import { createNote } from "@/domain/notes";
import { createTask } from "@/domain/tasks";

type CaptureType = "quest" | "note" | "reflection";

const captureTypeConfig: Record<
  CaptureType,
  { label: string; description: string; placeholder: string; destination: string }
> = {
  quest: {
    label: "Quest",
    description: "A commitment or next action",
    placeholder: "Book the appointment\nCall Monday morning after 9am.",
    destination: "/tasks"
  },
  note: {
    label: "Note",
    description: "Reference material to remember",
    placeholder: "Launch idea\nThe strongest positioning angle is…",
    destination: "/notes"
  },
  reflection: {
    label: "Reflection",
    description: "A lesson, observation, or feeling",
    placeholder: "What I noticed today…",
    destination: "/journal"
  }
};

export function CaptureWorkspace() {
  const [captureType, setCaptureType] = useState<CaptureType>("quest");
  const [draft, setDraft] = useState("");
  const [savedType, setSavedType] = useState<CaptureType | null>(null);
  const [error, setError] = useState<string | null>(null);

  function saveCapture() {
    const content = draft.trim();
    if (!content) {
      setError("Write something to capture first.");
      return;
    }

    const storage = window.localStorage;
    const [firstLine, ...rest] = content.split(/\r?\n/);
    const detail = rest.join("\n").trim();

    try {
      if (captureType === "quest") {
        const repository = createLocalTaskRepository(storage);
        repository.save([
          createTask({
            title: firstLine.slice(0, 160),
            description: detail || undefined,
            priority: "medium",
            tags: [],
            plannedForDate: toLocalIsoDate()
          }),
          ...repository.load()
        ]);
      } else if (captureType === "note") {
        const repository = createLocalNoteRepository(storage);
        repository.save([
          createNote({
            title: firstLine.slice(0, 120),
            content: detail || content,
            tags: ["inbox"]
          }),
          ...repository.load()
        ]);
      } else {
        const repository = createLocalJournalRepository(storage);
        repository.save([
          createJournalEntry({
            date: toLocalIsoDate(),
            type: "freeform",
            content
          }),
          ...repository.load()
        ]);
      }

      setSavedType(captureType);
      setDraft("");
      setError(null);
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "Couldn't save that capture.");
    }
  }

  const config = captureTypeConfig[captureType];

  return (
    <section className="capture-workspace" aria-labelledby="capture-title">
      <header className="capture-hero">
        <div>
          <p className="eyebrow">Universal inbox</p>
          <h1 id="capture-title">Capture</h1>
          <p>Get it out of your head now. Organize it when you have context.</p>
        </div>
      </header>

      <div className="capture-card">
        <div className="capture-type-tabs" role="group" aria-label="Capture type">
          {(Object.keys(captureTypeConfig) as CaptureType[]).map((type) => (
            <button
              key={type}
              type="button"
              aria-label={`Capture as ${captureTypeConfig[type].label}`}
              aria-pressed={captureType === type}
              className={captureType === type ? "capture-type capture-type-active" : "capture-type"}
              onClick={() => {
                setCaptureType(type);
                setSavedType(null);
                setError(null);
              }}
            >
              <strong>{captureTypeConfig[type].label}</strong>
              <span>{captureTypeConfig[type].description}</span>
            </button>
          ))}
        </div>

        <label className="capture-field">
          What do you want to capture?
          <textarea
            rows={7}
            value={draft}
            placeholder={config.placeholder}
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>

        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {savedType ? (
          <p className="capture-success" role="status">
            Saved as {captureTypeConfig[savedType].label.toLowerCase()}.{" "}
            <Link href={captureTypeConfig[savedType].destination}>Open it →</Link>
          </p>
        ) : null}

        <div className="capture-actions">
          <button type="button" className="login-submit" onClick={saveCapture}>
            Save {config.label}
          </button>
          <p>First line becomes the title for quests and notes.</p>
        </div>
      </div>
    </section>
  );
}
