"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { playDing } from "@/client/sfx";
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
import {
  getOrComputeWorkoutPlan,
  recomputeWorkoutPlan,
  suggestionToWorkoutInput,
  swapBucketPreset
} from "@/client/workoutSuggestion";
import type { DailyWorkoutPlan, WorkoutSuggestion } from "@/domain/workoutPlan";
import type { Workout, WorkoutType } from "@/domain";

const BUCKET_LABEL: Record<WorkoutType, string> = {
  strength: "Strength",
  cardio: "Cardio",
  martial_arts: "Martial arts"
};

function prettyIso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
}

function shiftDate(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + deltaDays);
  return toLocalIsoDate(dt);
}

function optionalMinutes(value: string): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function optionalWeight(value: string | undefined): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function optionalDistance(value: string | undefined): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function DailyFitness() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [now, setNow] = useState<Date | null>(null);
  const [viewedDate, setViewedDate] = useState<string | null>(null);

  // Strength form
  const [strengthDayId, setStrengthDayId] = useState(strengthWorkouts[0].id);
  const [variant, setVariant] = useState<StrengthVariant>("Free Weight");
  const [weights, setWeights] = useState<Record<string, string>>({});
  // Cardio form
  const [cardioId, setCardioId] = useState(cardioOptions[0].id);
  const [cardioMinutes, setCardioMinutes] = useState("");
  const [cardioDistance, setCardioDistance] = useState("");
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

  const todayIso = now ? toLocalIsoDate(now) : toLocalIsoDate(new Date());
  const viewed = viewedDate ?? todayIso;
  const isToday = viewed === todayIso;
  const status = useMemo(() => getDailyFitnessStatus(workouts, viewed), [workouts, viewed]);

  const persist = useCallback((next: Workout[]) => {
    createLocalWorkoutRepository(window.localStorage).save(next);
    setWorkouts(next);
  }, []);

  const addWorkout = useCallback(
    (workout: Workout) => {
      persist([workout, ...workouts]);
      playDing();
    },
    [persist, workouts]
  );

  const removeWorkout = useCallback(
    (id: string) => persist(workouts.filter((w) => w.id !== id)),
    [persist, workouts]
  );

  // Today's AI-picked plan (presets or custom). Falls back to deterministic.
  const [plan, setPlan] = useState<DailyWorkoutPlan | null>(null);
  const [recomputingPlan, setRecomputingPlan] = useState(false);

  useEffect(() => {
    void getOrComputeWorkoutPlan().then(setPlan);
  }, []);

  function logSuggestion(suggestion: WorkoutSuggestion) {
    addWorkout(createWorkout(suggestionToWorkoutInput(suggestion, viewed)));
  }

  function swap(bucket: WorkoutType) {
    if (plan) setPlan(swapBucketPreset(window.localStorage, plan, bucket));
  }

  async function handleRecomputePlan() {
    setRecomputingPlan(true);
    try {
      setPlan(await recomputeWorkoutPlan());
    } finally {
      setRecomputingPlan(false);
    }
  }

  // Most recent prior day that has workouts — powers "repeat" templating.
  const previousDay = useMemo(() => {
    const dates = [...new Set(workouts.filter((w) => w.date < viewed).map((w) => w.date))].sort(
      (a, b) => (a < b ? 1 : -1)
    );
    const date = dates[0];
    return date ? { date, workouts: workouts.filter((w) => w.date === date) } : null;
  }, [workouts, viewed]);

  const repeatPreviousDay = useCallback(() => {
    if (!previousDay) return;
    const now = new Date().toISOString();
    const existingTypes = new Set(
      workouts.filter((w) => w.date === viewed).map((w) => w.type)
    );
    const clones = previousDay.workouts
      .filter((w) => !existingTypes.has(w.type))
      .map((w, index) => ({
        ...w,
        id: globalThis.crypto?.randomUUID?.() ?? `workout-${now}-${index}`,
        date: viewed,
        recordedAt: now,
        createdAt: now,
        updatedAt: now
      }));
    if (clones.length > 0) {
      persist([...clones, ...workouts]);
    }
  }, [previousDay, persist, workouts, viewed]);

  const selectedStrength =
    strengthWorkouts.find((w) => w.id === strengthDayId) ?? strengthWorkouts[0];

  function logStrength() {
    addWorkout(
      createWorkout({
        date: viewed,
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
        date: viewed,
        type: "cardio",
        title: option.label,
        durationMinutes: optionalMinutes(cardioMinutes),
        distanceMiles: optionalDistance(cardioDistance),
        weightVestLbs: optionalWeight(cardioVestLbs)
      })
    );
    setCardioMinutes("");
    setCardioDistance("");
    setCardioVestLbs("");
  }

  function logMartial() {
    const option = martialArtsOptions.find((o) => o.id === martialId) ?? martialArtsOptions[0];
    addWorkout(
      createWorkout({
        date: viewed,
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
        <div className="fitness-datenav">
          <button
            type="button"
            className="fitness-datenav-btn"
            aria-label="Previous day"
            onClick={() => setViewedDate(shiftDate(viewed, -1))}
          >
            ◀
          </button>
          <h1 suppressHydrationWarning>
            {prettyIso(viewed)}
            {isToday ? <span className="fitness-today-tag">Today</span> : null}
          </h1>
          <button
            type="button"
            className="fitness-datenav-btn"
            aria-label="Next day"
            disabled={isToday}
            onClick={() => setViewedDate(shiftDate(viewed, 1))}
          >
            ▶
          </button>
        </div>
        <p className="fitness-sub">
          {isToday
            ? "Log all three sessions to close the day."
            : "Viewing a past day — you can still log a missed session."}
          {!isToday ? (
            <button
              type="button"
              className="fitness-jump-today"
              onClick={() => setViewedDate(todayIso)}
            >
              Jump to today
            </button>
          ) : null}
        </p>
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
        {status.isGoodDay ? (
          <p className="fitness-complete">
            ✓ Good day{status.bonusCount > 0 ? ` · +${status.bonusCount} bonus` : ""}
            {status.isComplete ? " — all three! 🔥" : ""}
          </p>
        ) : null}
        {!status.isComplete && previousDay ? (
          <button type="button" className="fitness-repeat-btn" onClick={repeatPreviousDay}>
            ↻ Repeat {prettyIso(previousDay.date)}&apos;s training
          </button>
        ) : null}
      </header>

      {/* Today's AI-picked plan */}
      {isToday && plan && plan.items.length > 0 ? (
        <section className="dashboard-section fitness-plan" aria-label="Today's workout">
          <header className="fitness-card-head">
            <div>
              <p className="eyebrow">Coach pick</p>
              <h2>Today&apos;s workout</h2>
            </div>
            <button
              type="button"
              className="nutri-mini-btn"
              onClick={() => void handleRecomputePlan()}
              disabled={recomputingPlan}
            >
              {recomputingPlan ? "Picking…" : "↻ Re-pick"}
            </button>
          </header>
          {plan.note ? <p className="reminders-help">{plan.note}</p> : null}
          <div className="fitness-plan-items">
            {plan.items.map((item) => {
              const done = Boolean(status.byType[item.bucket]);
              const isPrimary = item.bucket === "strength";
              return (
                <div key={item.bucket} className={`fitness-plan-item${done ? " is-done" : ""}`}>
                  <div className="fitness-plan-item-head">
                    <span className="fitness-plan-bucket">
                      {BUCKET_LABEL[item.bucket]}
                      {isPrimary ? "" : " · bonus"}
                    </span>
                    {done ? (
                      <span className="fitness-badge fitness-badge-done">Logged</span>
                    ) : item.estMinutes ? (
                      <span className="fitness-plan-mins">~{item.estMinutes} min</span>
                    ) : null}
                  </div>
                  <p className="fitness-plan-title">
                    {item.title}
                    {item.variant ? ` · ${item.variant}` : ""}
                  </p>
                  {item.rationale ? <p className="fitness-plan-why">{item.rationale}</p> : null}
                  {item.swaps && item.swaps.length > 0 ? (
                    <p className="fitness-plan-swap">⚠ {item.swaps.join(" · ")}</p>
                  ) : null}
                  {item.exercises && item.exercises.length > 0 ? (
                    <ul className="fitness-plan-ex">
                      {item.exercises.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                  {!done ? (
                    <div className="fitness-plan-actions">
                      <button
                        type="button"
                        className="command-button command-button-primary"
                        onClick={() => logSuggestion(item)}
                      >
                        <span>Log it</span>
                      </button>
                      <button type="button" className="command-button" onClick={() => swap(item.bucket)}>
                        <span>Swap</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

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
              {status.byType.cardio.distanceMiles
                ? ` · ${status.byType.cardio.distanceMiles} mi`
                : ""}
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
              Distance (mi) — optional
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                className="fitness-input"
                placeholder="e.g. 2.5"
                value={cardioDistance}
                onChange={(e) => setCardioDistance(e.target.value)}
              />
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
