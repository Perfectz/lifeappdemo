"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { CharacterSprite } from "@/components/CharacterSprite";
import { SectionHeader } from "@/components/SectionHeader";
import { dataChangedEventName } from "@/data/createLocalRepository";
import { createLocalFoodEntryRepository } from "@/data/foodEntryRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalWorkoutRepository } from "@/data/workoutRepository";
import { loadHealthGoals } from "@/data/healthGoalsRepository";
import { loadNutritionGoals } from "@/data/nutritionGoalsRepository";
import { computeDailyAlignment } from "@/domain/alignment";
import { computeBosses } from "@/domain/bosses";
import { computeCharacterStats } from "@/domain/characterStats";
import { toLocalIsoDate } from "@/domain/dates";
import { weightGoalProgressPercent } from "@/domain/healthGoals";
import { levelFromJourney } from "@/domain/levels";
import { getTransformation } from "@/domain/transformation";
import { latestWeight } from "@/domain/vitals";
import type { FoodEntry, MetricEntry, Workout } from "@/domain";

export function CharacterScreen() {
  const [metrics, setMetrics] = useState<MetricEntry[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [foods, setFoods] = useState<FoodEntry[]>([]);
  const today = toLocalIsoDate();

  const reload = useCallback(() => {
    const storage = window.localStorage;
    setMetrics(createLocalMetricRepository(storage).load());
    setWorkouts(createLocalWorkoutRepository(storage).load());
    setFoods(createLocalFoodEntryRepository(storage).load());
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(dataChangedEventName, reload);
    return () => window.removeEventListener(dataChangedEventName, reload);
  }, [reload]);

  const view = useMemo(() => {
    const storage = typeof window !== "undefined" ? window.localStorage : undefined;
    if (!storage) return null;
    const goals = loadHealthGoals(storage);
    const nutritionGoals = loadNutritionGoals(storage);
    const alignment = computeDailyAlignment({ today, metrics, workouts, goals, foods, nutritionGoals });
    const weightPercent = weightGoalProgressPercent(goals, latestWeight(metrics)?.weightLbs);
    const transformation = getTransformation({
      weightProgressPercent: weightPercent,
      alignmentPercent: alignment.percent
    });
    const level = levelFromJourney(transformation.progressPercent);
    const stats = computeCharacterStats({ today, metrics, workouts, goals });
    const bosses = computeBosses({ today, metrics, goals });
    return { level, stats, bosses };
  }, [today, metrics, workouts, foods]);

  if (!view) return null;
  const { level, stats, bosses } = view;

  return (
    <section className="character-screen" aria-labelledby="character-title">
      <header className="standup-hero">
        <div>
          <p className="eyebrow">Status</p>
          <h1 id="character-title">Character Sheet</h1>
          <p>Your stats and boss battles, leveled by real data.</p>
        </div>
        <div className="page-sprite-frame" aria-hidden="true">
          <CharacterSprite className="page-sprite" pose="idleFront" />
        </div>
      </header>

      <section className="dashboard-section" aria-label="Level">
        <p className="level-headline">
          <strong>Lv {level.level}</strong>
          <span>/ {level.maxLevel}</span>
          <em>{level.title}</em>
        </p>
        <div className="north-star-meter level-xp" aria-label={`${level.percentIntoLevel}% to next level`}>
          <span style={{ width: `${level.isMaxLevel ? 100 : level.percentIntoLevel}%` }} />
        </div>
        <p className="reminders-help">
          Overall power <strong>{stats.overall}</strong> · {level.journeyPercent}% of the journey to Patrick 2.0
        </p>
      </section>

      <section className="dashboard-section" aria-label="Stats">
        <SectionHeader eyebrow="Stats" title="Attributes" />
        <ul className="stat-sheet">
          {stats.stats.map((stat) => (
            <li className="stat-row" key={stat.key}>
              <span className="stat-key">{stat.label}</span>
              <div className="stat-bar" aria-hidden="true">
                <span style={{ width: `${Math.round((stat.value / 99) * 100)}%` }} />
              </div>
              <span className="stat-value">{stat.value}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="dashboard-section" aria-label="Boss battles">
        <SectionHeader eyebrow="Boss battles" title="Targets to defeat" />
        <div className="boss-list">
          {bosses.map((boss) => (
            <article
              className={boss.defeated ? "boss-card boss-card-defeated" : boss.engaged ? "boss-card" : "boss-card boss-card-locked"}
              key={boss.id}
            >
              <div className="boss-head">
                <strong>{boss.name}</strong>
                {boss.defeated ? (
                  <span className="boss-badge boss-badge-down">DEFEATED ✓</span>
                ) : boss.engaged ? (
                  <span className="boss-badge">{boss.hp}% HP</span>
                ) : (
                  <span className="boss-badge boss-badge-locked">LOCKED</span>
                )}
              </div>
              <p className="boss-flavor">{boss.flavor}</p>
              <div className="boss-hp" aria-hidden="true">
                <span
                  className={boss.defeated ? "boss-hp-fill boss-hp-fill-down" : "boss-hp-fill"}
                  style={{ width: `${boss.engaged ? boss.hp : 100}%` }}
                />
              </div>
              <p className="boss-detail reminders-help">{boss.detail}</p>
            </article>
          ))}
        </div>
        <p className="health-boundary">
          A motivational lens over your own data — not medical advice. Keep working with your provider on real targets.
        </p>
      </section>
    </section>
  );
}
