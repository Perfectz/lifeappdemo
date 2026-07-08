"use client";

import { useEffect, useState } from "react";

import { loadTrainingProfile, saveTrainingProfile } from "@/data/trainingProfileRepository";
import {
  coachStyleLabel,
  coachStyles,
  type CoachStyle,
  type TrainingEquipment,
  type TrainingProfile
} from "@/domain/trainingProfile";

const EQUIPMENT_LABEL: Record<keyof TrainingEquipment, string> = {
  kettlebells: "Kettlebells",
  dumbbells: "Dumbbells",
  bands: "Resistance bands",
  barbell: "Barbell",
  machines: "Machines",
  pullupBar: "Pull-up bar"
};

const EQUIPMENT_KEYS = Object.keys(EQUIPMENT_LABEL) as (keyof TrainingEquipment)[];

/**
 * Compact editable training profile (equipment / gym access / coach style /
 * notes) — what the workout coach programs against. Edits persist immediately;
 * the next "Re-pick" or tomorrow's plan uses them.
 */
export function TrainingProfilePanel() {
  const [profile, setProfile] = useState<TrainingProfile | null>(null);
  const [notesDraft, setNotesDraft] = useState("");

  useEffect(() => {
    const loaded = loadTrainingProfile(window.localStorage);
    setProfile(loaded);
    setNotesDraft(loaded.notes ?? "");
  }, []);

  if (!profile) return null;

  function persist(next: TrainingProfile) {
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    saveTrainingProfile(window.localStorage, stamped);
    setProfile(stamped);
  }

  function toggleEquipment(key: keyof TrainingEquipment) {
    if (!profile) return;
    persist({ ...profile, equipment: { ...profile.equipment, [key]: !profile.equipment[key] } });
  }

  function commitNotes() {
    if (!profile) return;
    const trimmed = notesDraft.trim();
    if ((profile.notes ?? "") === trimmed) return;
    persist({ ...profile, notes: trimmed || undefined });
  }

  return (
    <section className="dashboard-section fitness-card" aria-label="Training profile">
      <header className="fitness-card-head">
        <div>
          <p className="eyebrow">Coach setup</p>
          <h2>Training profile</h2>
        </div>
      </header>
      <p className="reminders-help">
        What the coach programs with. Changes apply to the next plan — hit ↻ Re-pick above to use
        them today.
      </p>
      <div className="fitness-form">
        <div className="fitness-label" role="group" aria-label="Equipment on hand">
          Equipment on hand
          {EQUIPMENT_KEYS.map((key) => (
            <label key={key} className="metrics-checkbox">
              <input
                type="checkbox"
                checked={profile.equipment[key]}
                onChange={() => toggleEquipment(key)}
              />
              <span>{EQUIPMENT_LABEL[key]}</span>
            </label>
          ))}
          <label className="metrics-checkbox">
            <input
              type="checkbox"
              checked={profile.gymAccess}
              onChange={() => persist({ ...profile, gymAccess: !profile.gymAccess })}
            />
            <span>Commercial gym access (barbells + machines)</span>
          </label>
        </div>
        <label className="fitness-label">
          Coach style
          <select
            className="fitness-select"
            value={profile.coachStyle}
            onChange={(e) => persist({ ...profile, coachStyle: e.target.value as CoachStyle })}
          >
            {coachStyles.map((style) => (
              <option key={style} value={style}>
                {coachStyleLabel[style]}
              </option>
            ))}
          </select>
        </label>
        <label className="fitness-label">
          Strength days per week — optional
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={7}
            className="fitness-input"
            placeholder="e.g. 3"
            value={profile.strengthDaysPerWeek ?? ""}
            onChange={(e) => {
              const n = Number(e.target.value);
              persist({
                ...profile,
                strengthDaysPerWeek: Number.isFinite(n) && n >= 1 && n <= 7 ? Math.round(n) : undefined
              });
            }}
          />
        </label>
        <label className="fitness-label">
          Notes for the coach — optional
          <textarea
            className="fitness-input"
            rows={2}
            placeholder="e.g. karate Tue/Thu nights, keep leg days off class days"
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={commitNotes}
          />
        </label>
      </div>
    </section>
  );
}
