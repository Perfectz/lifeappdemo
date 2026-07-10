"use client";

import { useEffect, useState } from "react";

import { loadTrainingProfile, saveTrainingProfile } from "@/data/trainingProfileRepository";
import {
  balancedWeeklySchedule,
  coachStyleLabel,
  coachStyles,
  weekdayKeys,
  weekdayLabel,
  type CoachStyle,
  type TrainingEquipment,
  type TrainingProfile,
  type WeekdayKey
} from "@/domain/trainingProfile";
import type { WorkoutType } from "@/domain/types";

const EQUIPMENT_LABEL: Record<keyof TrainingEquipment, string> = {
  kettlebells: "Kettlebells",
  dumbbells: "Dumbbells",
  bands: "Resistance bands",
  barbell: "Barbell",
  machines: "Machines",
  pullupBar: "Pull-up bar"
};

const EQUIPMENT_KEYS = Object.keys(EQUIPMENT_LABEL) as (keyof TrainingEquipment)[];

const SESSION_LABEL: Record<WorkoutType, string> = {
  strength: "Strength",
  cardio: "Cardio",
  martial_arts: "Martial arts"
};

const SESSION_TYPES = Object.keys(SESSION_LABEL) as WorkoutType[];

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

  function toggleSchedule(enabled: boolean) {
    if (!profile) return;
    persist({
      ...profile,
      weeklySchedule: enabled ? balancedWeeklySchedule() : undefined
    });
  }

  function toggleScheduledType(day: WeekdayKey, type: WorkoutType) {
    if (!profile?.weeklySchedule) return;
    const current = profile.weeklySchedule[day];
    persist({
      ...profile,
      weeklySchedule: {
        ...profile.weeklySchedule,
        [day]: current.includes(type)
          ? current.filter((entry) => entry !== type)
          : [...current, type]
      }
    });
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
        <div className="fitness-label training-schedule-editor">
          Weekly expectations
          <label className="metrics-checkbox">
            <input
              type="checkbox"
              checked={profile.weeklySchedule !== undefined}
              onChange={(event) => toggleSchedule(event.target.checked)}
            />
            <span>Use a weekly schedule with recovery days</span>
          </label>
          {profile.weeklySchedule ? (
            <div className="training-schedule-grid">
              {weekdayKeys.map((day) => (
                <div className="training-schedule-day" key={day}>
                  <strong>{weekdayLabel[day]}</strong>
                  <div>
                    {SESSION_TYPES.map((type) => (
                      <label className="metrics-checkbox" key={type}>
                        <input
                          type="checkbox"
                          checked={profile.weeklySchedule?.[day].includes(type) ?? false}
                          onChange={() => toggleScheduledType(day, type)}
                        />
                        <span>{SESSION_LABEL[type]}</span>
                      </label>
                    ))}
                  </div>
                  {profile.weeklySchedule?.[day].length === 0 ? <small>Recovery day</small> : null}
                </div>
              ))}
            </div>
          ) : (
            <small className="reminders-help">Legacy mode expects all three session types every day.</small>
          )}
        </div>
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
