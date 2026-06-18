"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useHeroName } from "@/client/useHeroName";
import { CharacterSprite } from "@/components/CharacterSprite";
import { CommandButton } from "@/components/CommandButton";
import { SectionHeader } from "@/components/SectionHeader";
import { dataChangedEventName } from "@/data/createLocalRepository";
import { createLocalDailyPlanRepository } from "@/data/dailyPlanRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalWorkoutRepository } from "@/data/workoutRepository";
import { glucoseContexts } from "@/domain/biometrics";
import { getDailyFitnessStatus } from "@/domain/dailyFitness";
import { toLocalIsoDate } from "@/domain/dates";
import { createMetricEntry, type MetricInput } from "@/domain/metrics";
import {
  bloodPressureCategoryLabel,
  latestBloodPressure,
  latestGlucose,
  latestWeight
} from "@/domain/vitals";
import type { DailyPlan, GlucoseContext, MetricEntry, Workout } from "@/domain";

function num(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function MorningStandup() {
  const [metrics, setMetrics] = useState<MetricEntry[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [now, setNow] = useState<Date | null>(null);

  const [glucose, setGlucose] = useState("");
  const [glucoseContext, setGlucoseContext] = useState("fasting");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [weight, setWeight] = useState("");
  const [intention, setIntention] = useState("");
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const heroName = useHeroName();

  const reload = useCallback(() => {
    const storage = window.localStorage;
    setMetrics(createLocalMetricRepository(storage).load());
    setWorkouts(createLocalWorkoutRepository(storage).load());
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
  const fitness = useMemo(() => getDailyFitnessStatus(workouts, today), [workouts, today]);
  const bp = latestBloodPressure(todayMetrics);
  const gl = latestGlucose(todayMetrics);
  const wt = latestWeight(todayMetrics);

  function logVitals() {
    const sys = num(systolic);
    const dia = num(diastolic);
    const w = num(weight);
    const glucoseMg = num(glucose);

    if (!sys && !dia && !w && !glucoseMg) {
      setStatus({ tone: "error", text: "Enter a glucose, blood pressure, or weight value." });
      return;
    }
    if ((sys && !dia) || (dia && !sys)) {
      setStatus({ tone: "error", text: "Enter both systolic and diastolic." });
      return;
    }

    const input: MetricInput = {
      date: today,
      checkInType: "morning",
      bloodGlucoseMgDl: glucoseMg,
      glucoseContext:
        glucoseMg && glucoseContexts.includes(glucoseContext as GlucoseContext)
          ? (glucoseContext as GlucoseContext)
          : undefined,
      bloodPressureSystolic: sys ? Math.round(sys) : undefined,
      bloodPressureDiastolic: dia ? Math.round(dia) : undefined,
      weightLbs: w,
      notes: "Morning vitals"
    };

    try {
      const entry = createMetricEntry(input);
      const repo = createLocalMetricRepository(window.localStorage);
      repo.save([entry, ...repo.load()]);
      setMetrics(repo.load());
      setGlucose("");
      setSystolic("");
      setDiastolic("");
      setWeight("");
      setStatus({ tone: "ok", text: "Morning vitals logged." });
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "Couldn't save vitals." });
    }
  }

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
    { label: "Strength", done: Boolean(fitness.byType.strength) },
    { label: "Cardio", done: Boolean(fitness.byType.cardio) },
    { label: "Martial arts", done: Boolean(fitness.byType.martial_arts) }
  ];

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

      {status ? (
        <p
          className={status.tone === "error" ? "form-error" : "standup-success"}
          role={status.tone === "error" ? "alert" : "status"}
        >
          {status.text}
        </p>
      ) : null}

      {/* Step 1 — Vitals */}
      <section className="dashboard-section" aria-label="Morning vitals">
        <SectionHeader eyebrow="Step 1" title="Log this morning's vitals" />
        {bp || gl || wt ? (
          <p className="reminders-help">
            Today so far:
            {gl ? ` glucose ${gl.mgDl} mg/dL ·` : ""}
            {bp ? ` BP ${bp.systolic}/${bp.diastolic} (${bloodPressureCategoryLabel[bp.category]}) ·` : ""}
            {wt ? ` weight ${wt.weightLbs} lb` : ""}
          </p>
        ) : (
          <p className="reminders-help">No vitals logged yet today.</p>
        )}
        <div className="vitals-form">
          <div className="vitals-bp-inputs">
            <label className="fitness-label">
              Glucose (mg/dL)
              <input type="number" inputMode="numeric" min={1} className="fitness-input" placeholder="e.g. 95" value={glucose} onChange={(e) => setGlucose(e.target.value)} />
            </label>
            <label className="fitness-label">
              When
              <select className="fitness-input" value={glucoseContext} onChange={(e) => setGlucoseContext(e.target.value)}>
                {glucoseContexts.map((context) => (
                  <option key={context} value={context}>
                    {context.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="vitals-bp-inputs">
            <label className="fitness-label">
              Systolic
              <input type="number" inputMode="numeric" min={1} className="fitness-input" placeholder="e.g. 122" value={systolic} onChange={(e) => setSystolic(e.target.value)} />
            </label>
            <span className="vitals-slash" aria-hidden="true">/</span>
            <label className="fitness-label">
              Diastolic
              <input type="number" inputMode="numeric" min={1} className="fitness-input" placeholder="e.g. 78" value={diastolic} onChange={(e) => setDiastolic(e.target.value)} />
            </label>
          </div>
          <label className="fitness-label">
            Weight (lb)
            <input type="number" inputMode="decimal" min={1} step="0.1" className="fitness-input" placeholder="e.g. 230" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </label>
          <button type="button" className="login-submit" onClick={logVitals}>
            <span>Log vitals</span>
          </button>
        </div>
      </section>

      {/* Step 2 — Training */}
      <section className="dashboard-section" aria-label="Today's training">
        <SectionHeader eyebrow="Step 2" title={`Today's training — ${fitness.completedCount}/3`} />
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
