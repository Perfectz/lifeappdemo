"use client";

import { useCallback, useEffect, useState } from "react";

import { CommandButton } from "@/components/CommandButton";
import { SectionHeader } from "@/components/SectionHeader";
import { dataChangedEventName } from "@/data/createLocalRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { loadBodyProfile } from "@/data/bodyProfileRepository";
import { loadTrainingProfile } from "@/data/trainingProfileRepository";
import { createLocalWorkoutRepository } from "@/data/workoutRepository";
import type { Workout, WorkoutType } from "@/domain";
import { toLocalIsoDate } from "@/domain/dates";
import { workoutTypesForDate } from "@/domain/trainingProfile";
import { hasCompletedSetup } from "@/domain/bodyProfile";

const TRAINING_BUCKETS: { type: WorkoutType; label: string; fallbackTitle: string }[] = [
  { type: "strength", label: "Strength", fallbackTitle: "Strength session" },
  { type: "cardio", label: "Cardio", fallbackTitle: "Cardio session" },
  { type: "martial_arts", label: "Martial Arts", fallbackTitle: "Martial arts session" }
];

/**
 * Health-first dashboard card: today's training status across the three
 * workout buckets (strength / cardio / martial arts), rendered as JRPG quest
 * slots. Self-loading like VitalsAlertBanner — reads the local repositories
 * directly and refreshes on any data change, so it can drop onto any screen.
 * A karate-class check-in (MetricEntry.karateClass) counts martial arts as
 * done even without a logged workout.
 */
export function TodayTrainingCard() {
  const [todaysWorkouts, setTodaysWorkouts] = useState<Workout[]>([]);
  const [karateLogged, setKarateLogged] = useState(false);
  const [expectedTypes, setExpectedTypes] = useState<WorkoutType[]>(
    TRAINING_BUCKETS.map((bucket) => bucket.type)
  );
  const [hasLoaded, setHasLoaded] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);

  const reload = useCallback(() => {
    const storage = window.localStorage;
    const today = toLocalIsoDate();
    setSetupComplete(hasCompletedSetup(loadBodyProfile(storage)));
    setExpectedTypes(workoutTypesForDate(loadTrainingProfile(storage), today));
    setTodaysWorkouts(
      createLocalWorkoutRepository(storage)
        .load()
        .filter((workout) => workout.date === today)
    );
    setKarateLogged(
      createLocalMetricRepository(storage)
        .load()
        .some((entry) => entry.date === today && entry.karateClass === true)
    );
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(dataChangedEventName, reload);
    return () => window.removeEventListener(dataChangedEventName, reload);
  }, [reload]);

  const slots = TRAINING_BUCKETS.filter((bucket) => expectedTypes.includes(bucket.type)).map((bucket) => {
    const logged = todaysWorkouts.find((workout) => workout.type === bucket.type);
    if (logged) {
      return { ...bucket, done: true, detail: logged.title?.trim() || bucket.fallbackTitle };
    }
    if (bucket.type === "martial_arts" && karateLogged) {
      return { ...bucket, done: true, detail: "Karate class" };
    }
    return { ...bucket, done: false, detail: undefined };
  });
  const doneCount = slots.filter((slot) => slot.done).length;

  return (
    <section className="dashboard-section training-card" aria-label="Today's training">
      <SectionHeader
        eyebrow="Training"
        title={
          hasLoaded && !setupComplete
            ? "Choose your training rhythm"
            : expectedTypes.length === 0
            ? "Today's Training — Recovery"
            : `Today's Training — ${doneCount}/${expectedTypes.length}`
        }
      />
      {hasLoaded && !setupComplete ? (
        <div className="dashboard-empty dashboard-empty-action">
          <strong>No training target yet.</strong>
          <p>Choose a realistic weekly rhythm before LifeQuest starts measuring the day.</p>
          <CommandButton href="/setup" icon="morning">
            Personalize training
          </CommandButton>
        </div>
      ) : null}
      {setupComplete && expectedTypes.length === 0 ? (
        <p className="training-empty-hint">
          Nothing is required today. Recover well; optional movement counts as bonus.
        </p>
      ) : null}
      {setupComplete ? <ul className="training-slots">
        {slots.map((slot) => (
          <li
            key={slot.type}
            className={slot.done ? "training-slot training-slot-done" : "training-slot"}
          >
            <span className="training-slot-name">{slot.label}</span>
            <span className="training-slot-status">
              {slot.done ? `${slot.detail} ✓` : "not yet"}
            </span>
          </li>
        ))}
      </ul> : null}
      {hasLoaded && setupComplete && expectedTypes.length > 0 && doneCount === 0 ? (
        <p className="training-empty-hint">
          Fresh log today — one session puts your first slot on the board.
        </p>
      ) : null}
      {setupComplete ? <div className="dashboard-card-cta">
        <CommandButton href="/fitness" icon="metrics">
          Open Training
        </CommandButton>
      </div> : null}
    </section>
  );
}
