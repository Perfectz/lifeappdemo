"use client";

import { useCallback, useEffect, useState } from "react";

import { SectionHeader } from "@/components/SectionHeader";
import { dataChangedEventName } from "@/data/createLocalRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { toLocalIsoDate } from "@/domain/dates";
import { createMetricEntry, type MetricInput } from "@/domain/metrics";
import {
  bloodPressureCategoryLabel,
  getVitalsReadings,
  latestBloodPressure,
  latestWeight
} from "@/domain/vitals";
import type { MetricEntry } from "@/domain";

function num(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function formatWhen(iso: string): string {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? iso : new Date(parsed).toLocaleString();
}

export function Vitals() {
  const [entries, setEntries] = useState<MetricEntry[]>([]);
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [weight, setWeight] = useState("");
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const reload = useCallback(() => {
    setEntries(createLocalMetricRepository(window.localStorage).load());
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(dataChangedEventName, reload);
    return () => window.removeEventListener(dataChangedEventName, reload);
  }, [reload]);

  function logVitals() {
    const sys = num(systolic);
    const dia = num(diastolic);
    const w = num(weight);

    if (!w && !sys && !dia) {
      setStatus({ tone: "error", text: "Enter a blood pressure or a weight." });
      return;
    }
    if ((sys && !dia) || (dia && !sys)) {
      setStatus({ tone: "error", text: "Enter both systolic and diastolic." });
      return;
    }

    const input: MetricInput = {
      date: toLocalIsoDate(new Date()),
      checkInType: "freeform",
      bloodPressureSystolic: sys ? Math.round(sys) : undefined,
      bloodPressureDiastolic: dia ? Math.round(dia) : undefined,
      weightLbs: w,
      notes: "Daily vitals"
    };

    try {
      const entry = createMetricEntry(input);
      const repo = createLocalMetricRepository(window.localStorage);
      repo.save([entry, ...repo.load()]);
      setEntries(repo.load());
      setSystolic("");
      setDiastolic("");
      setWeight("");
      setStatus({ tone: "ok", text: "Logged today's vitals." });
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "Couldn't save vitals." });
    }
  }

  const bp = latestBloodPressure(entries);
  const wt = latestWeight(entries);
  const history = getVitalsReadings(entries).slice(0, 14);

  return (
    <section className="dashboard-section vitals-panel" aria-label="Daily vitals">
      <SectionHeader eyebrow="Vitals" title="Blood pressure & weight" />
      <p className="reminders-help">
        Log today&apos;s blood pressure and body weight. Readings from voice, photo capture, and
        imports show up here too.
      </p>

      <div className="vitals-cards">
        <div className="vitals-card">
          <span className="eyebrow">Latest blood pressure</span>
          {bp ? (
            <>
              <strong className="vitals-value">
                {bp.systolic}/{bp.diastolic}
              </strong>
              <span className={`capture-confidence vitals-bp-${bp.category}`}>
                {bloodPressureCategoryLabel[bp.category]}
              </span>
              <small>{formatWhen(bp.recordedAt)}</small>
            </>
          ) : (
            <p className="reminders-help">No reading yet.</p>
          )}
        </div>
        <div className="vitals-card">
          <span className="eyebrow">Latest weight</span>
          {wt ? (
            <>
              <strong className="vitals-value">{wt.weightLbs} lb</strong>
              {wt.changeLbs !== undefined ? (
                <span className="vitals-delta">
                  {wt.changeLbs > 0 ? "▲" : wt.changeLbs < 0 ? "▼" : "—"}{" "}
                  {Math.abs(wt.changeLbs)} lb vs previous
                </span>
              ) : null}
              <small>{formatWhen(wt.recordedAt)}</small>
            </>
          ) : (
            <p className="reminders-help">No reading yet.</p>
          )}
        </div>
      </div>

      <div className="vitals-form">
        <div className="vitals-bp-inputs">
          <label className="fitness-label">
            Systolic
            <input
              type="number"
              inputMode="numeric"
              min={1}
              className="fitness-input"
              placeholder="e.g. 122"
              value={systolic}
              onChange={(event) => setSystolic(event.target.value)}
            />
          </label>
          <span className="vitals-slash" aria-hidden="true">
            /
          </span>
          <label className="fitness-label">
            Diastolic
            <input
              type="number"
              inputMode="numeric"
              min={1}
              className="fitness-input"
              placeholder="e.g. 78"
              value={diastolic}
              onChange={(event) => setDiastolic(event.target.value)}
            />
          </label>
        </div>
        <label className="fitness-label">
          Weight (lb)
          <input
            type="number"
            inputMode="decimal"
            min={1}
            step="0.1"
            className="fitness-input"
            placeholder="e.g. 184.5"
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
          />
        </label>
        <button type="button" className="login-submit" onClick={logVitals}>
          <span>Log vitals</span>
        </button>
        {status ? (
          <p
            className={status.tone === "error" ? "data-backup-status form-error" : "data-backup-status"}
            role={status.tone === "error" ? "alert" : "status"}
          >
            {status.text}
          </p>
        ) : null}
      </div>

      {history.length > 0 ? (
        <div>
          <h2 className="vitals-history-title">Recent readings</h2>
          <ul className="vitals-history">
            {history.map((entry) => (
              <li key={entry.id}>
                <span>{entry.date}</span>
                <span className="vitals-history-values">
                  {entry.bloodPressureSystolic !== undefined &&
                  entry.bloodPressureDiastolic !== undefined
                    ? `${entry.bloodPressureSystolic}/${entry.bloodPressureDiastolic}`
                    : ""}
                  {entry.weightLbs !== undefined ? ` · ${entry.weightLbs} lb` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="health-boundary">
        Vitals are tracked for your own reference — not medical advice. Discuss concerning readings
        with a healthcare professional.
      </p>
    </section>
  );
}
