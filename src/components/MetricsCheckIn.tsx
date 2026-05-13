"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

import { CharacterSprite } from "@/components/CharacterSprite";
import { SectionHeader } from "@/components/SectionHeader";
import { createLocalMetricRepository } from "@/data/metricRepository";
import type { CheckInType, MetricEntry, MetricInput } from "@/domain";
import { toLocalIsoDate } from "@/domain/dates";
import { createMetricEntry, getRecentMetricEntries, validateMetricInput } from "@/domain/metrics";

type MetricFormState = {
  date: string;
  checkInType: CheckInType;
  weightLbs: string;
  sleepHours: string;
  energyLevel: string;
  moodLevel: string;
  steps: string;
  workoutSummary: string;
  kettlebellSwingsTotal: string;
  karateClass: boolean;
  distanceWalkedMiles: string;
  bloodPressureSystolic: string;
  bloodPressureDiastolic: string;
  notes: string;
};

const healthBoundaryCopy =
  "This app tracks personal patterns and reflections. It does not provide medical diagnosis or treatment advice.";

function emptyForm(): MetricFormState {
  return {
    date: toLocalIsoDate(),
    checkInType: "morning",
    weightLbs: "",
    sleepHours: "",
    energyLevel: "",
    moodLevel: "",
    steps: "",
    workoutSummary: "",
    kettlebellSwingsTotal: "",
    karateClass: false,
    distanceWalkedMiles: "",
    bloodPressureSystolic: "",
    bloodPressureDiastolic: "",
    notes: ""
  };
}

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }

  return Number(value);
}

function buildMetricInput(form: MetricFormState): MetricInput {
  return {
    date: form.date,
    checkInType: form.checkInType,
    weightLbs: optionalNumber(form.weightLbs),
    sleepHours: optionalNumber(form.sleepHours),
    energyLevel: optionalNumber(form.energyLevel),
    moodLevel: optionalNumber(form.moodLevel),
    steps: optionalNumber(form.steps),
    workoutSummary: form.workoutSummary,
    kettlebellSwingsTotal: optionalNumber(form.kettlebellSwingsTotal),
    karateClass: form.karateClass,
    distanceWalkedMiles: optionalNumber(form.distanceWalkedMiles),
    bloodPressureSystolic: optionalNumber(form.bloodPressureSystolic),
    bloodPressureDiastolic: optionalNumber(form.bloodPressureDiastolic),
    notes: form.notes
  };
}

function formatMetricSummary(entry: MetricEntry): string {
  const parts = [
    entry.energyLevel ? `Energy ${entry.energyLevel}` : undefined,
    entry.moodLevel ? `Mood ${entry.moodLevel}` : undefined,
    entry.sleepHours !== undefined ? `Sleep ${entry.sleepHours}h` : undefined,
    entry.steps !== undefined ? `${entry.steps} steps` : undefined,
    entry.kettlebellSwingsTotal !== undefined
      ? `${entry.kettlebellSwingsTotal} swings`
      : undefined,
    entry.karateClass ? "Karate class" : undefined,
    entry.distanceWalkedMiles !== undefined
      ? `${entry.distanceWalkedMiles} mi walked`
      : undefined,
    entry.weightLbs !== undefined ? `${entry.weightLbs} lbs` : undefined
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" | ") : "Reflection-only check-in";
}

export function MetricsCheckIn() {
  const [entries, setEntries] = useState<MetricEntry[]>([]);
  const [form, setForm] = useState<MetricFormState>(() => emptyForm());
  const [hasLoaded, setHasLoaded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recentEntries = useMemo(() => getRecentMetricEntries(entries), [entries]);

  useEffect(() => {
    setEntries(createLocalMetricRepository(window.localStorage).load());
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    createLocalMetricRepository(window.localStorage).save(entries);
  }, [entries, hasLoaded]);

  function setField<Key extends keyof MetricFormState>(key: Key, value: MetricFormState[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input = buildMetricInput(form);
    const validation = validateMetricInput(input);

    if (!validation.ok) {
      setError(validation.message);
      setMessage(null);
      return;
    }

    const entry = createMetricEntry(validation.value);
    setEntries((current) => [entry, ...current]);
    setForm((current) => ({
      ...emptyForm(),
      date: current.date,
      checkInType: current.checkInType
    }));
    setError(null);
    setMessage("Metric check-in saved.");
  }

  return (
    <section className="metrics-page" aria-labelledby="metrics-title">
      <header className="metrics-hero">
        <div>
          <p className="eyebrow">Energy Check</p>
          <h1 id="metrics-title">Metrics</h1>
          <p>Log quick AM/PM context for energy, sleep, mood, movement, and notes.</p>
        </div>
        <div className="page-sprite-frame metrics-sprite" aria-hidden="true">
          <CharacterSprite className="page-sprite" pose="idleSide" />
        </div>
      </header>

      <p className="health-boundary">{healthBoundaryCopy}</p>

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

      <div className="metrics-layout">
        <section className="dashboard-section" aria-label="Metric check-in form">
          <SectionHeader eyebrow="Check-In" title="Log Metrics" />
          <form className="metrics-form" onSubmit={handleSubmit}>
            <div className="metrics-form-row">
              <label>
                <span>Date</span>
                <input
                  onChange={(event) => setField("date", event.target.value)}
                  type="date"
                  value={form.date}
                />
              </label>
              <label>
                <span>Check-in type</span>
                <select
                  onChange={(event) => setField("checkInType", event.target.value as CheckInType)}
                  value={form.checkInType}
                >
                  <option value="morning">morning</option>
                  <option value="evening">evening</option>
                  <option value="freeform">freeform</option>
                </select>
              </label>
            </div>

            <div className="metrics-form-grid">
              <label>
                <span>Weight</span>
                <input
                  inputMode="decimal"
                  onChange={(event) => setField("weightLbs", event.target.value)}
                  placeholder="lbs"
                  type="number"
                  value={form.weightLbs}
                />
              </label>
              <label>
                <span>Sleep duration</span>
                <input
                  inputMode="decimal"
                  onChange={(event) => setField("sleepHours", event.target.value)}
                  placeholder="hours"
                  step="0.25"
                  type="number"
                  value={form.sleepHours}
                />
              </label>
              <label>
                <span>Energy level</span>
                <select
                  onChange={(event) => setField("energyLevel", event.target.value)}
                  value={form.energyLevel}
                >
                  <option value="">Not set</option>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Mood level</span>
                <select
                  onChange={(event) => setField("moodLevel", event.target.value)}
                  value={form.moodLevel}
                >
                  <option value="">Not set</option>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Steps</span>
                <input
                  inputMode="numeric"
                  onChange={(event) => setField("steps", event.target.value)}
                  placeholder="0"
                  type="number"
                  value={form.steps}
                />
              </label>
              <label>
                <span>Kettlebell swings total</span>
                <input
                  inputMode="numeric"
                  onChange={(event) => setField("kettlebellSwingsTotal", event.target.value)}
                  placeholder="0"
                  type="number"
                  value={form.kettlebellSwingsTotal}
                />
              </label>
              <label>
                <span>Distance walked</span>
                <input
                  inputMode="decimal"
                  onChange={(event) => setField("distanceWalkedMiles", event.target.value)}
                  placeholder="miles"
                  step="0.1"
                  type="number"
                  value={form.distanceWalkedMiles}
                />
              </label>
              <label className="metrics-checkbox">
                <input
                  checked={form.karateClass}
                  onChange={(event) => setField("karateClass", event.target.checked)}
                  type="checkbox"
                />
                <span>Karate class</span>
              </label>
              <label>
                <span>Blood pressure systolic</span>
                <input
                  inputMode="numeric"
                  onChange={(event) => setField("bloodPressureSystolic", event.target.value)}
                  placeholder="120"
                  type="number"
                  value={form.bloodPressureSystolic}
                />
              </label>
              <label>
                <span>Blood pressure diastolic</span>
                <input
                  inputMode="numeric"
                  onChange={(event) => setField("bloodPressureDiastolic", event.target.value)}
                  placeholder="80"
                  type="number"
                  value={form.bloodPressureDiastolic}
                />
              </label>
            </div>

            <label>
              <span>Workout summary</span>
              <input
                onChange={(event) => setField("workoutSummary", event.target.value)}
                placeholder="Optional"
                type="text"
                value={form.workoutSummary}
              />
            </label>
            <label>
              <span>Notes</span>
              <textarea
                onChange={(event) => setField("notes", event.target.value)}
                placeholder="Optional context"
                value={form.notes}
              />
            </label>
            <button type="submit">Save Metrics</button>
          </form>
        </section>

        <aside className="dashboard-section" aria-label="Recent metric entries">
          <SectionHeader eyebrow="Recent" title="Metric Entries" />
          {!hasLoaded ? <p className="quest-empty">Loading metrics...</p> : null}
          {hasLoaded && recentEntries.length === 0 ? (
            <p className="quest-empty">No metric entries yet.</p>
          ) : null}
          <div className="metric-entry-list">
            {recentEntries.map((entry) => (
              <article className="metric-entry-card" key={entry.id}>
                <div>
                  <h3>
                    {entry.date} - {entry.checkInType}
                  </h3>
                  <p>{formatMetricSummary(entry)}</p>
                </div>
                <small>Source: {entry.source}</small>
                {entry.kettlebellSwingsTotal !== undefined ? (
                  <small>{entry.kettlebellSwingsTotal} kettlebell swings</small>
                ) : null}
                {entry.karateClass ? <small>Karate class</small> : null}
                {entry.distanceWalkedMiles !== undefined ? (
                  <small>{entry.distanceWalkedMiles} mi walked</small>
                ) : null}
                {entry.workoutSummary ? <small>{entry.workoutSummary}</small> : null}
              </article>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

export { healthBoundaryCopy };
