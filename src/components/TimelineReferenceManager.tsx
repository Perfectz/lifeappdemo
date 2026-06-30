"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  addReference,
  loadHydratedReferences,
  removeReference,
  type HydratedReference
} from "@/client/timelineReferences";
import { timelineImageChangedEvent } from "@/data/timelineImageStore";
import {
  poseTypeLabel,
  poseTypes,
  referenceImageRoleLabel,
  referenceImageRoles,
  type PoseType,
  type ReferenceImageRole
} from "@/domain/timelineMirror";

export function TimelineReferenceManager() {
  const [refs, setRefs] = useState<HydratedReference[]>([]);
  const [role, setRole] = useState<ReferenceImageRole>("ideal");
  const [poseType, setPoseType] = useState<PoseType>("front_full_body");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(() => {
    void loadHydratedReferences().then(setRefs);
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(timelineImageChangedEvent, reload);
    return () => window.removeEventListener(timelineImageChangedEvent, reload);
  }, [reload]);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      await addReference({ file, role, poseType });
      reload();
    } catch {
      setError("Couldn't save that reference image.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await removeReference(id);
      reload();
    } catch {
      setError("Couldn't remove that image.");
    }
  }

  const byRole = (r: ReferenceImageRole) => refs.filter((x) => x.role === r);

  return (
    <div className="timeline-refs">
      <h3>Reference images</h3>
      <p className="reminders-help">
        Store the visual poles the mirror compares against. <strong>Baseline</strong> is where you
        started, <strong>Ideal</strong> is your Patrick 2.0, <strong>Warning</strong> is the
        timeline you refuse to feed. Images stay on this device.
      </p>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="timeline-ref-add">
        <label>
          <span>Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value as ReferenceImageRole)}>
            {referenceImageRoles.map((r) => (
              <option key={r} value={r}>
                {referenceImageRoleLabel[r]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Pose</span>
          <select value={poseType} onChange={(e) => setPoseType(e.target.value as PoseType)}>
            {poseTypes.map((p) => (
              <option key={p} value={p}>
                {poseTypeLabel[p]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="command-button command-button-primary"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
        >
          <span>{busy ? "Saving…" : "+ Add image"}</span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="visually-hidden"
          aria-label="Add reference image"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = "";
          }}
        />
      </div>

      {referenceImageRoles.map((r) => {
        const items = byRole(r);
        return (
          <div key={r} className="timeline-ref-group">
            <h4>
              {referenceImageRoleLabel[r]} <span className="timeline-ref-count">({items.length})</span>
            </h4>
            {items.length === 0 ? (
              <p className="timeline-ref-empty">No {referenceImageRoleLabel[r].toLowerCase()} images yet.</p>
            ) : (
              <div className="timeline-ref-grid">
                {items.map((ref) => (
                  <figure key={ref.id} className="timeline-ref-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ref.dataUrl} alt={`${referenceImageRoleLabel[ref.role]} — ${poseTypeLabel[ref.poseType]}`} />
                    <figcaption>{poseTypeLabel[ref.poseType]}</figcaption>
                    <button type="button" className="command-button" onClick={() => void remove(ref.id)}>
                      <span>Remove</span>
                    </button>
                  </figure>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
