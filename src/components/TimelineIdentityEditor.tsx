"use client";

import { useEffect, useState } from "react";

import { pushIdentityDocToCloud } from "@/client/timelineCloud";
import { DEFAULT_IDEAL_MARKDOWN, DEFAULT_WARNING_MARKDOWN } from "@/client/timelineContext";
import {
  getTimelineIdentityDoc,
  upsertTimelineIdentityDoc
} from "@/data/timelineIdentityRepository";
import {
  timelineIdentityDocTypeLabel,
  type TimelineIdentityDoc,
  type TimelineIdentityDocType
} from "@/domain/timelineMirror";

function uid(): string {
  return `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const defaults: Record<TimelineIdentityDocType, string> = {
  ideal_version: DEFAULT_IDEAL_MARKDOWN,
  warning_version: DEFAULT_WARNING_MARKDOWN
};

function DocEditor({ docType }: { docType: TimelineIdentityDocType }) {
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const existing = getTimelineIdentityDoc(docType);
    setContent(existing?.markdownContent ?? defaults[docType]);
    setLoaded(true);
  }, [docType]);

  function save() {
    const now = new Date().toISOString();
    const existing = getTimelineIdentityDoc(docType);
    const doc: TimelineIdentityDoc = {
      id: existing?.id ?? uid(),
      docType,
      title: timelineIdentityDocTypeLabel[docType],
      markdownContent: content,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    upsertTimelineIdentityDoc(doc);
    void pushIdentityDocToCloud(doc);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  if (!loaded) return null;

  return (
    <div className="timeline-doc-editor">
      <div className="timeline-doc-head">
        <h4>{timelineIdentityDocTypeLabel[docType]}</h4>
        <div className="timeline-doc-actions">
          <button
            type="button"
            className="command-button"
            onClick={() => setShowPreview((v) => !v)}
          >
            <span>{showPreview ? "Edit" : "Preview"}</span>
          </button>
          <button type="button" className="command-button command-button-primary" onClick={save}>
            <span>{saved ? "Saved ✓" : "Save"}</span>
          </button>
        </div>
      </div>
      {showPreview ? (
        <pre className="timeline-doc-preview">{content}</pre>
      ) : (
        <textarea
          className="timeline-doc-textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={12}
          aria-label={`${timelineIdentityDocTypeLabel[docType]} markdown`}
          spellCheck
        />
      )}
    </div>
  );
}

export function TimelineIdentityEditor() {
  return (
    <div className="timeline-identity">
      <h3>Identity rubrics</h3>
      <p className="reminders-help">
        Describe who you&apos;re becoming and who you refuse to become. The mirror uses these as its
        narrative rubric. Markdown supported. Sensible defaults are pre-filled — make them yours.
      </p>
      <DocEditor docType="ideal_version" />
      <DocEditor docType="warning_version" />
    </div>
  );
}
