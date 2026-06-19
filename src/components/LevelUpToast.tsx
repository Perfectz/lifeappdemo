"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { playLevelUp } from "@/client/sfx";
import { CharacterSprite } from "@/components/CharacterSprite";
import { dataChangedEventName } from "@/data/createLocalRepository";
import { createLocalFoodEntryRepository } from "@/data/foodEntryRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalWorkoutRepository } from "@/data/workoutRepository";
import { loadHealthGoals } from "@/data/healthGoalsRepository";
import { loadNutritionGoals } from "@/data/nutritionGoalsRepository";
import { computeDailyAlignment } from "@/domain/alignment";
import { toLocalIsoDate } from "@/domain/dates";
import { weightGoalProgressPercent } from "@/domain/healthGoals";
import { levelFromJourney, shouldCelebrateLevelUp } from "@/domain/levels";
import { getTransformation } from "@/domain/transformation";
import { latestWeight } from "@/domain/vitals";

const LAST_LEVEL_KEY = "lifequest.lastLevel.v1";

function currentLevel(storage: Storage): number {
  const today = toLocalIsoDate();
  const metrics = createLocalMetricRepository(storage).load();
  const workouts = createLocalWorkoutRepository(storage).load();
  const foods = createLocalFoodEntryRepository(storage).load();
  const goals = loadHealthGoals(storage);
  const nutritionGoals = loadNutritionGoals(storage);
  const alignment = computeDailyAlignment({ today, metrics, workouts, goals, foods, nutritionGoals });
  const weightPercent = weightGoalProgressPercent(goals, latestWeight(metrics)?.weightLbs);
  const transformation = getTransformation({
    weightProgressPercent: weightPercent,
    alignmentPercent: alignment.percent
  });
  return levelFromJourney(transformation.progressPercent).level;
}

function readStoredLevel(storage: Storage): number | null {
  try {
    const raw = storage.getItem(LAST_LEVEL_KEY);
    return raw === null ? null : Number(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeStoredLevel(storage: Storage, level: number): void {
  try {
    storage.setItem(LAST_LEVEL_KEY, JSON.stringify(level));
  } catch {
    // non-fatal
  }
}

export function LevelUpToast() {
  const [celebrateLevel, setCelebrateLevel] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const check = useCallback(() => {
    const storage = window.localStorage;
    const level = currentLevel(storage);
    const prev = readStoredLevel(storage);
    if (shouldCelebrateLevelUp(prev, level)) {
      setCelebrateLevel(level);
      playLevelUp();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCelebrateLevel(null), 4500);
    }
    if (prev === null || level !== prev) {
      writeStoredLevel(storage, level);
    }
  }, []);

  useEffect(() => {
    check();
    window.addEventListener(dataChangedEventName, check);
    return () => {
      window.removeEventListener(dataChangedEventName, check);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [check]);

  if (celebrateLevel === null) return null;

  return (
    <div className="levelup-toast" role="status" aria-live="polite" onClick={() => setCelebrateLevel(null)}>
      <div className="levelup-card">
        <CharacterSprite className="levelup-sprite" pose="victory" />
        <p className="levelup-kicker">Level up!</p>
        <p className="levelup-level">Lv {celebrateLevel}</p>
        <p className="reminders-help">One step closer to Patrick 2.0.</p>
      </div>
    </div>
  );
}
