"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useHeroName } from "@/client/useHeroName";
import { CharacterSprite } from "@/components/CharacterSprite";
import { CommandButton } from "@/components/CommandButton";
import { SectionHeader } from "@/components/SectionHeader";
import { VitalsAlertBanner } from "@/components/VitalsAlertBanner";
import { VitalsQuickForm } from "@/components/VitalsQuickForm";
import { dataChangedEventName } from "@/data/createLocalRepository";
import { createLocalDailyPlanRepository } from "@/data/dailyPlanRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { loadTrainingProfile } from "@/data/trainingProfileRepository";
import { createLocalWorkoutRepository } from "@/data/workoutRepository";
import { getDailyFitnessStatus } from "@/domain/dailyFitness";
import { toLocalIsoDate } from "@/domain/dates";
import { workoutTypesForDate, type TrainingProfile } from "@/domain/trainingProfile";
import { latestBloodPressure, latestGlucose, latestWeight } from "@/domain/vitals";
import type { DailyPlan, MetricEntry, Workout } from "@/domain";

export function MorningStandup() {
  const [metrics, setMetrics] = useState<MetricEntry[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [trainingProfile, setTrainingProfile] = useState<TrainingProfile | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  const [intention, setIntention] = useState("");
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const heroName = useHeroName();

  const reload = useCallback(() => {
    const storage = window.localStorage;
    setMetrics(createLocalMetricRepository(storage).load());
    setWorkouts(createLocalWorkoutRepository(storage).load());
    setTrainingProfile(loadTrainingProfile(storage));
  }, []);

  useEffect(() => {
    setNow(new Date());
    reload();
    const today = toLocalIsoDate();
    const plan = createLocalDailyPlanRepository(window.localStorage)
      .load()
      .find((entry) => entry.date === today);
    if (plan?.intention) setIntention(plan.intention);
    window.addEventListener(dataChangedEventName, reload);
    return () => window.removeEventListener(dataChangedEventName, reload);
  }, [reload]);

  const today = now ? toLocalIsoDate(now) : toLocalIsoDate(new Date());
  const todayMetrics = useMemo(() => metrics.filter((m) => m.date === today), [metrics, today]);
  const fitness = useMemo(
    () =>
      getDailyFitnessStatus(
        workouts,
        today,
        trainingProfile ? workoutTypesForDate(trainingProfile, today) : undefined
      ),
    [workouts, today, trainingProfile]
  );
  const bp = latestBloodPressure(todayMetrics);
  const gl = latestGlucose(todayMetrics);
  const wt = latestWeight(todayMetrics);
  const vitalsLogged = Boolean(gl || bp || wt);

  function saveIntention() {
    const repo = createLocalDailyPlanRepository(window.localStorage);
    const all = repo.load();
    const nowIso = new Date().toISOString();
    const existing = all.find((plan) => plan.date === today);
    const trimmed = intention.trim() || undefined;
    let next: DailyPlan[];
    if (existing) {
      next = all.map((plan) =>
        plan.id === existing.id ? { ...plan, intention: trimmed, updatedAt: nowIso } : plan
      );
    } else {
      next = [
        {
          id: globalThis.crypto?.randomUUID?.() ?? `plan-${nowIso}`,
          date: today,
          sideQuestTaskIds: [],
          intention: trimmed,
          status: "planned",
          createdAt: nowIso,
          updatedAt: nowIso
        },
        ...all
      ];
    }
    repo.save(next);
    setStatus({ tone: "ok", text: "Intention saved. Have a strong day." });
  }

  const sessionRows = [
    { type: "strength" as const, label: "Strength", done: Boolean(fitness.byType.strength) },
    { type: "cardio" as const, label: "Cardio", done: Boolean(fitness.byType.cardio) },
    { type: "martial_arts" as const, label: "Martial arts", done: Boolean(fitness.byType.martial_arts) }
  ].filter((session) => fitness.expectedTypes.includes(session.type));

  return (
    <section className="standup-page morning-checkin" aria-labelledby="morning-standup-title">
      <header className="standup-hero">
        <div>
          <p className="eyebrow">Morning check-in</p>
          <h1 id="morning-standup-title">Good morning, {heroName}</h1>
          <p>Log your vitals, line up today&apos;s training, and set one intention.</p>
        </div>
        <div className="page-sprite-frame standup-sprite" aria-hidden="true">
          <CharacterSprite className="page-sprite" pose="walkFrontOne" />
        </div>
      </header>

      <VitalsAlertBanner />

      {status ? (
        <p
          className={status.tone === "error" ? "form-error" : "standup-success"}
          role={status.tone === "error" ? "alert" : "status"}
        >
          {status.text}
        </p>
      ) : null}

      {/* Step 1 — Vitals. Once anything is logged today, collapse to a summary
          so the standup doesn't invite a duplicate entry — /vitals stays the
          place for additional readings. */}
      <section className="dashboard-section" aria-label="Morning vitals">
        <SectionHeader eyebrow="Step 1" title="Log this morning's vitals" />
        {vitalsLogged ? (
          <p className="reminders-help standup-vitals-summary">
            Vitals logged ✓ (
            {[
              gl ? `glucose ${gl.mgDl} mg/dL` : null,
              bp ? `BP ${bp.systolic}/${bp.diastolic}` : null,
              wt ? `weight ${wt.weightLbs} lb` : null
            ]
              .filter(Boolean)
              .join(" · ")}
            )
          </p>
        ) : (
          <>
            <p className="reminders-help">No vitals logged yet today.</p>
            <VitalsQuickForm
              checkInType="morning"
              onSaved={() => setStatus({ tone: "ok", text: "Morning vitals logged." })}
            />
          </>
        )}
      </section>

      {/* Step 2 — Training */}
      <section className="dashboard-section" aria-label="Today's training">
        <SectionHeader
          eyebrow="Step 2"
          title={
            fitness.isRestDay
              ? "Today's training — recovery day"
              : `Today's training — ${fitness.completedCount}/${fitness.expectedCount}`
          }
        />
        {fitness.isRestDay ? <p className="quest-empty">No sessions are required today.</p> : null}
        <ul className="checkin-sessions">
          {sessionRows.map((row) => (
            <li key={row.label} className={row.done ? "checkin-session checkin-session-done" : "checkin-session"}>
              <span>{row.done ? "✓" : "○"}</span>
              {row.label}
            </li>
          ))}
        </ul>
        <CommandButton href="/fitness" icon="metrics">
          {fitness.isComplete ? "Review today's workouts" : "Open Fitness to log"}
        </CommandButton>
        <CommandButton href="/progress" icon="trends">
          Take today&apos;s progress photos
        </CommandButton>
      </section>

      {/* Step 3 — Intention */}
      <section className="dashboard-section" aria-label="Daily intention">
        <SectionHeader eyebrow="Step 3" title="Set today's intention" />
        <label className="intention-field">
          <span>What matters most today?</span>
          <textarea
            className="wiki-textarea"
            rows={3}
            placeholder="One sentence to anchor the day…"
            value={intention}
            onChange={(event) => setIntention(event.target.value)}
          />
        </label>
        <div className="standup-actions">
          <button type="button" className="login-submit" onClick={saveIntention}>
            <span>Save intention</span>
          </button>
          <CommandButton href="/dashboard" icon="dashboard">
            Return to Dashboard
          </CommandButton>
        </div>
      </section>
    </section>
  );
}
