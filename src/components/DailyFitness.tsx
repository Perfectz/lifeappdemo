"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { celebrate } from "@/client/celebrate";
import { playDing, playVictory } from "@/client/sfx";
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
import {
  detectNewRecords,
  formatRecordTitle,
  prSetIndexesForWorkout
} from "@/domain/personalRecords";
import { createWorkout } from "@/domain/workouts";
import {
  getOrComputeWorkoutPlan,
  recomputeWorkoutPlan,
  suggestionToWorkoutInput,
  swapBucketPreset
} from "@/client/workoutSuggestion";
import { RestTimer } from "@/components/RestTimer";
import { TrainingProfilePanel } from "@/components/TrainingProfilePanel";
import { formatPrescriptionScheme } from "@/domain/coachProgram";
import type { ExercisePrescription } from "@/domain/strengthProgression";
import type { DailyWorkoutPlan, WorkoutSuggestion } from "@/domain/workoutPlan";
import type { Workout, WorkoutType } from "@/domain";

type PrescriptionDraftRow = {
  exercise: string;
  sets: string;
  reps: string;
  weight: string;
  note?: string;
};

type PrescriptionDraft = {
  title: string;
  summary?: string;
  rows: PrescriptionDraftRow[];
};

function positiveInt(value: string, fallback: number): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

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

/** "1 warm-up, then 4 sets increasing weight — triples: 135/155/175/185" or "5×5 @ 190 lb". */
const schemeText = formatPrescriptionScheme;

/**
 * The prescription list. Split-style sessions (Vinny) carry muscle-group
 * headers — render Chest / Tris / Bis blocks with numbered exercises. Plans
 * without groups (older cached plans, simple-progressive) keep the flat list.
 */
function PrescriptionList({ prescriptions }: { prescriptions: ExercisePrescription[] }) {
  if (!prescriptions.some((p) => p.group)) {
    return (
      <ul className="fitness-plan-ex">
        {prescriptions.map((p, i) => (
          <li key={`${p.exercise}-${i}`}>
            <strong>{p.exercise}</strong> — {schemeText(p)}
            {p.note ? (
              <>
                <br />
                <small>{p.note}</small>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    );
  }

  const groups: { name?: string; items: ExercisePrescription[] }[] = [];
  for (const p of prescriptions) {
    const last = groups[groups.length - 1];
    if (last && (p.group ?? "") === (last.name ?? "")) last.items.push(p);
    else groups.push({ name: p.group, items: [p] });
  }
  return (
    <div className="fitness-plan-groups">
      {groups.map((g, gi) => (
        <div key={`${g.name ?? "group"}-${gi}`} className="fitness-plan-group">
          {g.name ? <p className="fitness-plan-group-name">{g.name}</p> : null}
          <ol className="fitness-plan-ex">
            {g.items.map((p, i) => (
              <li key={`${p.exercise}-${i}`}>
                <strong>{p.exercise}</strong> — {schemeText(p)}
                {p.note ? (
                  <>
                    <br />
                    <small>{p.note}</small>
                  </>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
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

  // "PR" badges for the logged strength rows — recomputed from history, never persisted.
  const loggedStrength = status.byType.strength;
  const strengthPrIndexes = useMemo(
    () => (loggedStrength ? prSetIndexesForWorkout(workouts, loggedStrength) : new Set<number>()),
    [workouts, loggedStrength]
  );

  const persist = useCallback((next: Workout[]) => {
    createLocalWorkoutRepository(window.localStorage).save(next);
    setWorkouts(next);
  }, []);

  // Rest timer chip: shown after a strength log; remounting via key restarts it.
  const [restTimerKey, setRestTimerKey] = useState<number | null>(null);
  const dismissRestTimer = useCallback(() => setRestTimerKey(null), []);

  const addWorkout = useCallback(
    (workout: Workout) => {
      persist([workout, ...workouts]);
      if (workout.type === "strength") {
        // PR detection runs against the history as it stood before this log.
        const records = detectNewRecords(workouts, workout);
        if (records.length > 0) {
          celebrate({
            kind: "pr",
            title: formatRecordTitle(records[0]),
            subtitle: records[0].summary,
            pose: "victory"
          });
          playVictory();
        } else {
          playDing();
        }
        setRestTimerKey(Date.now());
      } else {
        playDing();
      }
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
    let cancelled = false;
    void getOrComputeWorkoutPlan().then((next) => {
      if (!cancelled) setPlan(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function logSuggestion(suggestion: WorkoutSuggestion) {
    addWorkout(createWorkout(suggestionToWorkoutInput(suggestion, viewed)));
  }

  // "Log as prescribed": prefill an editable copy of the coach's prescription,
  // let the user adjust sets/reps/weight, then save through the normal
  // createWorkout/addWorkout path.
  const [prescriptionDraft, setPrescriptionDraft] = useState<PrescriptionDraft | null>(null);

  function startPrescribedLog(suggestion: WorkoutSuggestion) {
    setPrescriptionDraft({
      title: suggestion.title,
      summary: suggestion.progressionSummary ?? suggestion.description,
      rows: (suggestion.prescriptions ?? []).map((p) => ({
        exercise: p.exercise,
        sets: String(p.sets),
        reps: String(p.reps),
        weight: p.weightLbs !== undefined ? String(p.weightLbs) : "",
        note: p.note
      }))
    });
  }

  function updateDraftRow(index: number, patch: Partial<PrescriptionDraftRow>) {
    setPrescriptionDraft((prev) =>
      prev
        ? { ...prev, rows: prev.rows.map((row, i) => (i === index ? { ...row, ...patch } : row)) }
        : prev
    );
  }

  function savePrescribedLog() {
    if (!prescriptionDraft) return;
    const sets = prescriptionDraft.rows.flatMap((row) => {
      const setCount = positiveInt(row.sets, 1);
      const reps = positiveInt(row.reps, 1);
      const weightLbs = optionalWeight(row.weight);
      return Array.from({ length: setCount }, () => ({ exercise: row.exercise, reps, weightLbs }));
    });
    addWorkout(
      createWorkout({
        date: viewed,
        type: "strength",
        source: "ai",
        title: prescriptionDraft.title,
        notes: prescriptionDraft.summary,
        sets
      })
    );
    setPrescriptionDraft(null);
  }

  function swap(bucket: WorkoutType) {
    if (bucket === "strength") setPrescriptionDraft(null);
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
              // Old cached plans predate prescriptions — guard the optional field.
              const hasPrescriptions =
                item.bucket === "strength" &&
                Array.isArray(item.prescriptions) &&
                item.prescriptions.length > 0;
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
                  {hasPrescriptions ? (
                    <>
                      {item.progressionSummary ? (
                        <p className="fitness-plan-why">{item.progressionSummary}</p>
                      ) : null}
                      {item.description ? (
                        <p className="fitness-plan-tip">“{item.description}” — Coach</p>
                      ) : null}
                      <PrescriptionList prescriptions={item.prescriptions!} />
                    </>
                  ) : item.exercises && item.exercises.length > 0 ? (
                    <ul className="fitness-plan-ex">
                      {item.exercises.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                  {!done && hasPrescriptions && prescriptionDraft ? (
                    <div className="fitness-form" aria-label="Log as prescribed">
                      {prescriptionDraft.rows.map((row, i) => (
                        <div key={`${row.exercise}-${i}`} className="fitness-exercise-detail">
                          <p className="fitness-exercise-name">{row.exercise}</p>
                          <label className="fitness-label">
                            Sets
                            <input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              className="fitness-input"
                              value={row.sets}
                              onChange={(e) => updateDraftRow(i, { sets: e.target.value })}
                            />
                          </label>
                          <label className="fitness-label">
                            Reps
                            <input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              className="fitness-input"
                              value={row.reps}
                              onChange={(e) => updateDraftRow(i, { reps: e.target.value })}
                            />
                          </label>
                          <label className="fitness-label">
                            Weight (lb)
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step="2.5"
                              className="fitness-input"
                              placeholder="bodyweight"
                              value={row.weight}
                              onChange={(e) => updateDraftRow(i, { weight: e.target.value })}
                            />
                          </label>
                        </div>
                      ))}
                      <div className="fitness-plan-actions">
                        <button
                          type="button"
                          className="command-button command-button-primary"
                          onClick={savePrescribedLog}
                        >
                          <span>Save session</span>
                        </button>
                        <button
                          type="button"
                          className="command-button"
                          onClick={() => setPrescriptionDraft(null)}
                        >
                          <span>Cancel</span>
                        </button>
                      </div>
                    </div>
                  ) : !done ? (
                    <div className="fitness-plan-actions">
                      {hasPrescriptions ? (
                        <button
                          type="button"
                          className="command-button command-button-primary"
                          onClick={() => startPrescribedLog(item)}
                        >
                          <span>Log as prescribed</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="command-button command-button-primary"
                          onClick={() => logSuggestion(item)}
                        >
                          <span>Log it</span>
                        </button>
                      )}
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
                    <span>
                      {set.exercise}
                      {strengthPrIndexes.has(index) ? (
                        <span className="fitness-pr-badge" title="Personal record">
                          PR
                        </span>
                      ) : null}
                    </span>
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

      {/* Training profile — what the coach programs with */}
      <TrainingProfilePanel />

      {/* Between-sets rest countdown — dismissible, never blocks logging. */}
      {restTimerKey !== null ? <RestTimer key={restTimerKey} onDismiss={dismissRestTimer} /> : null}
    </section>
  );
}
