"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { dataChangedEventName } from "@/data/createLocalRepository";
import { createLocalWorkoutRepository } from "@/data/workoutRepository";
import {
  cardioOptions,
  equipmentForVariant,
  getExerciseVariant,
  martialArtsOptions,
  strengthVariants,
  strengthWorkouts,
  type StrengthVariant
} from "@/config/fitness";
import { getDailyFitnessStatus } from "@/domain/dailyFitness";
import { toLocalIsoDate } from "@/domain/dates";
import { createWorkout } from "@/domain/workouts";
import type { Workout } from "@/domain";

function prettyDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
}

function optionalMinutes(value: string): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function optionalWeight(value: string | undefined): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function DailyFitness() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [now, setNow] = useState<Date | null>(null);

  // Strength form
  const [strengthDayId, setStrengthDayId] = useState(strengthWorkouts[0].id);
  const [variant, setVariant] = useState<StrengthVariant>("Free Weight");
  const [weights, setWeights] = useState<Record<string, string>>({});
  // Cardio form
  const [cardioId, setCardioId] = useState(cardioOptions[0].id);
  const [cardioMinutes, setCardioMinutes] = useState("");
  const [cardioVestLbs, setCardioVestLbs] = useState("");
  // Martial arts form
  const [martialId, setMartialId] = useState(martialArtsOptions[0].id);
  const [martialMinutes, setMartialMinutes] = useState("");

  const reload = useCallback(() => {
    setWorkouts(createLocalWorkoutRepository(window.localStorage).load());
  }, []);

  useEffect(() => {
    setNow(new Date());
    reload();
    window.addEventListener(dataChangedEventName, reload);
    return () => window.removeEventListener(dataChangedEventName, reload);
  }, [reload]);

  const today = now ? toLocalIsoDate(now) : toLocalIsoDate(new Date());
  const status = useMemo(() => getDailyFitnessStatus(workouts, today), [workouts, today]);

  const persist = useCallback((next: Workout[]) => {
    createLocalWorkoutRepository(window.localStorage).save(next);
    setWorkouts(next);
  }, []);

  const addWorkout = useCallback(
    (workout: Workout) => persist([workout, ...workouts]),
    [persist, workouts]
  );

  const removeWorkout = useCallback(
    (id: string) => persist(workouts.filter((w) => w.id !== id)),
    [persist, workouts]
  );

  const selectedStrength =
    strengthWorkouts.find((w) => w.id === strengthDayId) ?? strengthWorkouts[0];

  function logStrength() {
    addWorkout(
      createWorkout({
        date: today,
        type: "strength",
        title: `Day ${selectedStrength.day} — ${selectedStrength.name} · ${variant}`,
        equipment: equipmentForVariant(variant),
        sets: selectedStrength.exercises.map((exercise) => {
          const detail = getExerciseVariant(exercise, variant);
          return {
            exercise: `${detail.name} (${exercise.scheme})`,
            weightLbs: optionalWeight(weights[exercise.name])
          };
        })
      })
    );
    setWeights({});
  }

  function logCardio() {
    const option = cardioOptions.find((o) => o.id === cardioId) ?? cardioOptions[0];
    addWorkout(
      createWorkout({
        date: today,
        type: "cardio",
        title: option.label,
        durationMinutes: optionalMinutes(cardioMinutes),
        weightVestLbs: optionalWeight(cardioVestLbs)
      })
    );
    setCardioMinutes("");
    setCardioVestLbs("");
  }

  function logMartial() {
    const option = martialArtsOptions.find((o) => o.id === martialId) ?? martialArtsOptions[0];
    addWorkout(
      createWorkout({
        date: today,
        type: "martial_arts",
        title: option.label,
        durationMinutes: optionalMinutes(martialMinutes)
      })
    );
    setMartialMinutes("");
  }

  return (
    <section className="fitness">
      <header className="dashboard-section fitness-header">
        <p className="eyebrow">Daily Training</p>
        <h1 suppressHydrationWarning>{now ? prettyDate(now) : "Today"}</h1>
        <p className="fitness-sub">Log all three sessions to close the day.</p>
        <div
          className="fitness-pips"
          role="img"
          aria-label={`${status.completedCount} of 3 sessions complete`}
        >
          {(["strength", "cardio", "martial_arts"] as const).map((type) => (
            <span
              key={type}
              className={status.byType[type] ? "fitness-pip fitness-pip-done" : "fitness-pip"}
            />
          ))}
          <strong className="fitness-count">{status.completedCount}/3</strong>
        </div>
        {status.isComplete ? (
          <p className="fitness-complete">✓ Day complete — all three sessions logged.</p>
        ) : null}
      </header>

      {/* Strength */}
      <section className="dashboard-section fitness-card">
        <header className="fitness-card-head">
          <h2>Strength</h2>
          <span className={status.byType.strength ? "fitness-badge fitness-badge-done" : "fitness-badge"}>
            {status.byType.strength ? "Logged" : "To do"}
          </span>
        </header>
        {status.byType.strength ? (
          <div className="fitness-logged">
            <p>
              <strong>{status.byType.strength.title}</strong>
            </p>
            {status.byType.strength.sets && status.byType.strength.sets.length > 0 ? (
              <ul className="fitness-set-list">
                {status.byType.strength.sets.map((set, index) => (
                  <li key={`${set.exercise}-${index}`}>
                    <span>{set.exercise}</span>
                    {set.weightLbs ? <small>{set.weightLbs} lb</small> : null}
                  </li>
                ))}
              </ul>
            ) : null}
            <button
              type="button"
              className="command-button"
              onClick={() => removeWorkout(status.byType.strength!.id)}
            >
              <span>Remove</span>
            </button>
          </div>
        ) : (
          <div className="fitness-form">
            <label className="fitness-label">
              Workout
              <select
                className="fitness-select"
                value={strengthDayId}
                onChange={(e) => setStrengthDayId(e.target.value)}
              >
                {strengthWorkouts.map((w) => (
                  <option key={w.id} value={w.id}>
                    Day {w.day} — {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="fitness-label">
              Equipment
              <select
                className="fitness-select"
                value={variant}
                onChange={(e) => setVariant(e.target.value as StrengthVariant)}
              >
                {strengthVariants.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <div className="fitness-exercises">
              {selectedStrength.exercises.map((exercise) => {
                const detail = getExerciseVariant(exercise, variant);
                return (
                  <details key={exercise.name} className="fitness-exercise">
                    <summary className="fitness-exercise-summary">
                      <span className="fitness-exercise-name">{exercise.name}</span>
                      <small className="fitness-exercise-scheme">{exercise.scheme}</small>
                    </summary>
                    <div className="fitness-exercise-detail">
                      <p className="fitness-exercise-variant">{detail.name}</p>
                      <p className="fitness-exercise-instructions">{detail.instructions}</p>
                      <a
                        className="fitness-video-link"
                        href={detail.video}
                        target="_blank"
                        rel="noreferrer"
                      >
                        ▶ Watch a form video
                      </a>
                      <label className="fitness-exercise-weight">
                        Weight (lb)
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          className="fitness-input"
                          placeholder="e.g. 25"
                          value={weights[exercise.name] ?? ""}
                          onChange={(e) =>
                            setWeights((prev) => ({ ...prev, [exercise.name]: e.target.value }))
                          }
                        />
                      </label>
                    </div>
                  </details>
                );
              })}
            </div>
            <button type="button" className="command-button" onClick={logStrength}>
              <span>Log strength</span>
            </button>
          </div>
        )}
      </section>

      {/* Cardio */}
      <section className="dashboard-section fitness-card">
        <header className="fitness-card-head">
          <h2>Cardio</h2>
          <span className={status.byType.cardio ? "fitness-badge fitness-badge-done" : "fitness-badge"}>
            {status.byType.cardio ? "Logged" : "To do"}
          </span>
        </header>
        {status.byType.cardio ? (
          <div className="fitness-logged">
            <p>
              <strong>{status.byType.cardio.title}</strong>
              {status.byType.cardio.durationMinutes
                ? ` · ${status.byType.cardio.durationMinutes} min`
                : ""}
              {status.byType.cardio.weightVestLbs
                ? ` · ${status.byType.cardio.weightVestLbs} lb vest`
                : ""}
            </p>
            <button
              type="button"
              className="command-button"
              onClick={() => removeWorkout(status.byType.cardio!.id)}
            >
              <span>Remove</span>
            </button>
          </div>
        ) : (
          <div className="fitness-form">
            <label className="fitness-label">
              Activity
              <select
                className="fitness-select"
                value={cardioId}
                onChange={(e) => setCardioId(e.target.value)}
              >
                {cardioOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="fitness-label">
              Minutes
              <input
                type="number"
                inputMode="numeric"
                min={1}
                className="fitness-input"
                placeholder="e.g. 30"
                value={cardioMinutes}
                onChange={(e) => setCardioMinutes(e.target.value)}
              />
            </label>
            <label className="fitness-label">
              Weight vest (lb) — optional
              <input
                type="number"
                inputMode="numeric"
                min={0}
                className="fitness-input"
                placeholder="e.g. 20"
                value={cardioVestLbs}
                onChange={(e) => setCardioVestLbs(e.target.value)}
              />
            </label>
            <button type="button" className="command-button" onClick={logCardio}>
              <span>Log cardio</span>
            </button>
          </div>
        )}
      </section>

      {/* Martial arts */}
      <section className="dashboard-section fitness-card">
        <header className="fitness-card-head">
          <h2>Martial Arts</h2>
          <span
            className={
              status.byType.martial_arts ? "fitness-badge fitness-badge-done" : "fitness-badge"
            }
          >
            {status.byType.martial_arts ? "Logged" : "To do"}
          </span>
        </header>
        {status.byType.martial_arts ? (
          <div className="fitness-logged">
            <p>
              <strong>{status.byType.martial_arts.title}</strong>
              {status.byType.martial_arts.durationMinutes
                ? ` · ${status.byType.martial_arts.durationMinutes} min`
                : ""}
            </p>
            <button
              type="button"
              className="command-button"
              onClick={() => removeWorkout(status.byType.martial_arts!.id)}
            >
              <span>Remove</span>
            </button>
          </div>
        ) : (
          <div className="fitness-form">
            <label className="fitness-label">
              Session
              <select
                className="fitness-select"
                value={martialId}
                onChange={(e) => setMartialId(e.target.value)}
              >
                {martialArtsOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="fitness-label">
              Minutes
              <input
                type="number"
                inputMode="numeric"
                min={1}
                className="fitness-input"
                placeholder="e.g. 45"
                value={martialMinutes}
                onChange={(e) => setMartialMinutes(e.target.value)}
              />
            </label>
            <button type="button" className="command-button" onClick={logMartial}>
              <span>Log martial arts</span>
            </button>
          </div>
        )}
      </section>
    </section>
  );
}
