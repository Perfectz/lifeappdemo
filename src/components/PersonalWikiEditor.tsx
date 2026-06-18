"use client";

import { useEffect, useState } from "react";

import { SectionHeader } from "@/components/SectionHeader";
import { loadWiki, saveWiki } from "@/data/wikiRepository";
import {
  parseWikiMarkdown,
  WIKI_SECTIONS,
  type WikiSectionId
} from "@/domain/personalWiki";

type Draft = Record<WikiSectionId, string>;

export function PersonalWikiEditor() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    setDraft(loadWiki(window.localStorage).sections);
  }, []);

  function setSection(id: WikiSectionId, value: string) {
    setDraft((current) => (current ? { ...current, [id]: value } : current));
  }

  function save() {
    if (!draft) return;
    saveWiki(window.localStorage, { sections: draft, updatedAt: new Date().toISOString() });
    setStatus({ tone: "ok", text: "Saved. Your coach and voice assistant now use this." });
  }

  function importDump() {
    const parsed = parseWikiMarkdown(importText);
    const keys = Object.keys(parsed) as WikiSectionId[];
    if (keys.length === 0) {
      setStatus({ tone: "error", text: "Couldn't find any \"## Section\" headings to import." });
      return;
    }
    setDraft((current) => {
      const base = current ?? ({} as Draft);
      const next = { ...base };
      for (const key of keys) next[key] = parsed[key] ?? "";
      return next;
    });
    setImportText("");
    setShowImport(false);
    setStatus({
      tone: "ok",
      text: `Imported ${keys.length} section${keys.length === 1 ? "" : "s"} — review below, then Save.`
    });
  }

  if (!draft) {
    return <p className="quest-empty">Loading…</p>;
  }

  return (
    <section className="dashboard-section wiki-editor" aria-label="About me">
      <SectionHeader eyebrow="Personal context" title="About Me" />
      <p className="reminders-help">
        A profile your AI coach, trainer, and assistant read so they actually know you. You author
        it; the assistant can later propose edits for you to approve.
      </p>
      <p className="health-boundary">
        Stored on this device and in your private cloud sync, and sent to the AI when you use it.
        Leave out anything you&apos;d rather not share.
      </p>

      <div className="data-backup-actions">
        <button type="button" className="command-button" onClick={() => setShowImport((v) => !v)}>
          <span>{showImport ? "Hide import" : "Paste to import"}</span>
        </button>
        <button type="button" className="login-submit" onClick={save}>
          <span>Save</span>
        </button>
      </div>

      {showImport ? (
        <div className="wiki-import">
          <label className="fitness-label">
            Paste a profile with <code>## Section</code> headings (e.g. an export from another AI)
            <textarea
              className="wiki-textarea"
              rows={6}
              placeholder="## Profile&#10;...&#10;## Health&#10;..."
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
            />
          </label>
          <button type="button" className="command-button" onClick={importDump} disabled={!importText.trim()}>
            <span>Import sections</span>
          </button>
        </div>
      ) : null}

      {status ? (
        <p
          className={status.tone === "error" ? "data-backup-status form-error" : "data-backup-status"}
          role={status.tone === "error" ? "alert" : "status"}
        >
          {status.text}
        </p>
      ) : null}

      <div className="wiki-sections">
        {WIKI_SECTIONS.map((section) => (
          <label key={section.id} className="fitness-label wiki-section">
            <span className="wiki-section-title">{section.title}</span>
            <span className="wiki-section-hint">{section.hint}</span>
            <textarea
              className="wiki-textarea"
              rows={5}
              value={draft[section.id]}
              onChange={(event) => setSection(section.id, event.target.value)}
            />
          </label>
        ))}
      </div>

      <div className="data-backup-actions">
        <button type="button" className="login-submit" onClick={save}>
          <span>Save</span>
        </button>
      </div>
    </section>
  );
}
