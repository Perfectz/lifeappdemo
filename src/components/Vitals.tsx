"use client";

import { useCallback, useEffect, useState } from "react";

import { SectionHeader } from "@/components/SectionHeader";
import { VitalsAlertBanner } from "@/components/VitalsAlertBanner";
import { VitalsQuickForm } from "@/components/VitalsQuickForm";
import { dataChangedEventName } from "@/data/createLocalRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { toLocalIsoDate } from "@/domain/dates";
import {
  bloodPressureCategoryLabel,
  getVitalsReadings,
  getVitalsTrend,
  glucoseBandLabel,
  latestBloodPressure,
  latestGlucose,
  latestWeight
} from "@/domain/vitals";
import type { MetricEntry } from "@/domain";

function formatWhen(iso: string): string {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? iso : new Date(parsed).toLocaleString();
}

export function Vitals() {
  const [entries, setEntries] = useState<MetricEntry[]>([]);

  const reload = useCallback(() => {
    setEntries(createLocalMetricRepository(window.localStorage).load());
  }, []);

  useEffect(() => {
    // Repository saves (including VitalsQuickForm's) dispatch
    // dataChangedEventName, so the cards and trends below stay live.
    reload();
    window.addEventListener(dataChangedEventName, reload);
    return () => window.removeEventListener(dataChangedEventName, reload);
  }, [reload]);

  const gl = latestGlucose(entries);
  const bp = latestBloodPressure(entries);
  const wt = latestWeight(entries);
  const history = getVitalsReadings(entries).slice(0, 14);
  const trend = getVitalsTrend(entries, toLocalIsoDate(new Date()), 14);

  return (
    <section className="dashboard-section vitals-panel" aria-label="Daily vitals">
      <VitalsAlertBanner />
      <SectionHeader eyebrow="Vitals" title="Glucose, blood pressure & weight" />
      <p className="reminders-help">
        Log today&apos;s glucose, blood pressure, and body weight. Readings from voice, photo
        capture, and imports show up here too.
      </p>

      <div className="vitals-cards">
        <div className="vitals-card">
          <span className="eyebrow">Latest glucose</span>
          {gl ? (
            <>
              <strong className="vitals-value">{gl.mgDl} mg/dL</strong>
              <small>
                {gl.context ? gl.context.replace(/_/g, " ") : "reading"}
                {gl.band ? ` · ${glucoseBandLabel[gl.band]}` : ""}
              </small>
              <small>{formatWhen(gl.recordedAt)}</small>
            </>
          ) : (
            <p className="reminders-help">No reading yet.</p>
          )}
        </div>
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

      <VitalsQuickForm checkInType="freeform" />

      {history.length > 0 ? (
        <div className="vitals-trends">
          <h2 className="vitals-history-title">14-day trend</h2>
          <div className="vitals-trend-row">
            <div className="vitals-trend-label">
              <strong>Glucose</strong>
              <small>{trend.avgGlucose ? `avg ${trend.avgGlucose} mg/dL` : "—"}</small>
            </div>
            <Sparkline values={trend.points.map((point) => point.glucose)} color="var(--accent)" />
          </div>
          <div className="vitals-trend-row">
            <div className="vitals-trend-label">
              <strong>Blood pressure</strong>
              <small>
                {trend.avgSystolic && trend.avgDiastolic
                  ? `avg ${trend.avgSystolic}/${trend.avgDiastolic}`
                  : "—"}
              </small>
            </div>
            <Sparkline values={trend.points.map((point) => point.systolic)} color="var(--warning)" />
          </div>
          <div className="vitals-trend-row">
            <div className="vitals-trend-label">
              <strong>Weight</strong>
              <small>{wt ? `${wt.weightLbs} lb` : "—"}</small>
            </div>
            <Sparkline
              values={trend.points.map((point) => point.weightLbs)}
              color="var(--line-strong, #55d6a5)"
            />
          </div>
        </div>
      ) : null}

      {history.length > 0 ? (
        <div>
          <h2 className="vitals-history-title">Recent readings</h2>
          <ul className="vitals-history">
            {history.map((entry) => (
              <li key={entry.id}>
                <span>{entry.date}</span>
                <span className="vitals-history-values">
                  {entry.bloodGlucoseMgDl !== undefined
                    ? `${entry.bloodGlucoseMgDl} mg/dL`
                    : ""}
                  {entry.bloodPressureSystolic !== undefined &&
                  entry.bloodPressureDiastolic !== undefined
                    ? `${entry.bloodGlucoseMgDl !== undefined ? " · " : ""}${entry.bloodPressureSystolic}/${entry.bloodPressureDiastolic}`
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

function Sparkline({ values, color }: { values: (number | undefined)[]; color: string }) {
  const defined = values
    .map((value, index) => ({ value, index }))
    .filter((point): point is { value: number; index: number } => point.value !== undefined);

  if (defined.length < 2) {
    return <span className="vitals-spark-empty">Not enough data yet</span>;
  }

  const nums = defined.map((point) => point.value);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  const width = 220;
  const height = 44;
  const pad = 4;
  const xAt = (index: number) =>
    values.length > 1 ? pad + (index / (values.length - 1)) * (width - 2 * pad) : width / 2;
  const yAt = (value: number) => height - pad - ((value - min) / range) * (height - 2 * pad);
  const polyline = defined.map((point) => `${xAt(point.index).toFixed(1)},${yAt(point.value).toFixed(1)}`).join(" ");

  return (
    <svg
      className="vitals-spark"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Trend, latest ${nums[nums.length - 1]}`}
    >
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {defined.map((point) => (
        <circle key={point.index} cx={xAt(point.index)} cy={yAt(point.value)} r="2.5" fill={color} />
      ))}
    </svg>
  );
}
