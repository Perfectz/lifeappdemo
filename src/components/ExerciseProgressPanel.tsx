"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { SectionHeader } from "@/components/SectionHeader";
import { dataChangedEventName } from "@/data/createLocalRepository";
import { createLocalWorkoutRepository } from "@/data/workoutRepository";
import {
  buildExerciseSeries,
  getExerciseSeriesStats,
  listTrackedExercises,
  type ExerciseSeriesPoint
} from "@/domain/exerciseTrends";
import type { Workout } from "@/domain";

function shortDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return month && day ? `${Number(month)}/${Number(day)}` : iso;
}

export function ExerciseProgressPanel() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const reload = useCallback(() => {
    setWorkouts(createLocalWorkoutRepository(window.localStorage).load());
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(dataChangedEventName, reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener(dataChangedEventName, reload);
      window.removeEventListener("storage", reload);
    };
  }, [reload]);

  const tracked = useMemo(() => listTrackedExercises(workouts), [workouts]);
  const exercise = selected && tracked.includes(selected) ? selected : tracked[0];
  const points = useMemo(
    () => (exercise ? buildExerciseSeries(workouts, exercise) : []),
    [workouts, exercise]
  );
  const stats = useMemo(() => getExerciseSeriesStats(points), [points]);

  return (
    <section className="dashboard-section" aria-label="Strength progress">
      <SectionHeader eyebrow="Strength" title="Strength Progress" />

      {tracked.length === 0 || !exercise ? (
        <p className="quest-empty">Log the same lift twice and the chart appears.</p>
      ) : (
        <>
          <label className="fitness-label">
            Exercise
            <select
              className="fitness-input"
              value={exercise}
              onChange={(event) => setSelected(event.target.value)}
            >
              {tracked.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          <E1RmChart points={points} />

          <p className="trends-caption">
            {shortDate(points[0].date)} → {shortDate(points[points.length - 1].date)} ·{" "}
            {points.length} session{points.length === 1 ? "" : "s"} · e1RM line, top set dashed
          </p>

          {stats ? (
            <div className="nutri-trend-averages">
              <span>
                Current e1RM <strong>{stats.currentE1Rm} lb</strong>
              </span>
              <span>
                All-time best <strong>{stats.bestE1Rm} lb</strong>
              </span>
              <span
                className={
                  stats.change30dLbs > 0
                    ? "capture-confidence capture-confidence-high"
                    : stats.change30dLbs < 0
                      ? "capture-confidence capture-confidence-low"
                      : "capture-confidence capture-confidence-medium"
                }
              >
                {stats.change30dLbs > 0 ? "+" : stats.change30dLbs < 0 ? "−" : "±"}
                {Math.abs(stats.change30dLbs)} lb / 30d
              </span>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function E1RmChart({ points }: { points: ExerciseSeriesPoint[] }) {
  const width = 220;
  const height = 88;
  const pad = 6;

  const values = points.flatMap((point) => [point.e1Rm, point.topSetWeightLbs]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const xAt = (index: number) =>
    points.length > 1 ? pad + (index / (points.length - 1)) * (width - 2 * pad) : width / 2;
  const yAt = (value: number) => height - pad - ((value - min) / range) * (height - 2 * pad);

  const e1RmLine = points
    .map((point, index) => `${xAt(index).toFixed(1)},${yAt(point.e1Rm).toFixed(1)}`)
    .join(" ");
  const topSetLine = points
    .map((point, index) => `${xAt(index).toFixed(1)},${yAt(point.topSetWeightLbs).toFixed(1)}`)
    .join(" ");

  return (
    <svg
      className="vitals-spark"
      style={{ height: "8rem" }}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Estimated 1RM over ${points.length} sessions, latest ${points[points.length - 1].e1Rm} lb`}
    >
      <polyline
        points={topSetLine}
        fill="none"
        stroke="var(--muted)"
        strokeWidth="1.5"
        strokeDasharray="4 3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polyline
        points={e1RmLine}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.map((point, index) => (
        <circle
          key={point.date}
          cx={xAt(index)}
          cy={yAt(point.e1Rm)}
          r="2.5"
          fill="var(--accent)"
        >
          <title>
            {`${shortDate(point.date)} · ${point.topSetWeightLbs} lb ×${point.topSetReps} → e1RM ${point.e1Rm}`}
          </title>
        </circle>
      ))}
    </svg>
  );
}
