"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CharacterSprite } from "@/components/CharacterSprite";
import { CommandButton } from "@/components/CommandButton";
import { SectionHeader } from "@/components/SectionHeader";
import { fileToDownscaledDataUrl } from "@/client/imageDownscale";
import { dataChangedEventName } from "@/data/createLocalRepository";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalWorkoutRepository } from "@/data/workoutRepository";
import { createLocalFoodEntryRepository } from "@/data/foodEntryRepository";
import { loadHealthGoals, saveHealthGoals } from "@/data/healthGoalsRepository";
import { loadNutritionGoals } from "@/data/nutritionGoalsRepository";
import { loadTrainingProfile } from "@/data/trainingProfileRepository";
import { goalImageChangedEvent, loadGoalImage, saveGoalImage } from "@/data/goalImageStore";
import { computeDailyAlignment } from "@/domain/alignment";
import { getTransformation, type TransformationStage } from "@/domain/transformation";
import { levelFromJourney } from "@/domain/levels";
import { getDailyFitnessStatus } from "@/domain/dailyFitness";
import { toLocalIsoDate } from "@/domain/dates";
import { weightGoalProgressPercent, withGoalEdits, type HealthGoals } from "@/domain/healthGoals";
import { type NutritionGoals } from "@/domain/nutritionGoals";
import { workoutTypesForDate, type TrainingProfile } from "@/domain/trainingProfile";
import {
  bloodPressureCategoryLabel,
  glucoseBandLabel,
  latestBloodPressure,
  latestGlucose,
  latestWeight
} from "@/domain/vitals";
import type { FoodEntry, MetricEntry, Workout } from "@/domain";

function num(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

const STAGE_POSE: Record<TransformationStage, "lowEnergy" | "thinking" | "walkFrontOne" | "idleFront" | "victory"> = {
  1: "lowEnergy",
  2: "thinking",
  3: "walkFrontOne",
  4: "idleFront",
  5: "victory"
};

export function NorthStarCard() {
  const [metrics, setMetrics] = useState<MetricEntry[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [foods, setFoods] = useState<FoodEntry[]>([]);
  const [goals, setGoals] = useState<HealthGoals | null>(null);
  const [nutritionGoals, setNutritionGoals] = useState<NutritionGoals | null>(null);
  const [trainingProfile, setTrainingProfile] = useState<TrainingProfile | null>(null);
  const [editingWeight, setEditingWeight] = useState(false);
  const [weightTargetDraft, setWeightTargetDraft] = useState("");
  const [goalImage, setGoalImage] = useState<string | null>(null);
  const goalInputRef = useRef<HTMLInputElement | null>(null);

  const today = toLocalIsoDate();

  const reload = useCallback(() => {
    const storage = window.localStorage;
    setMetrics(createLocalMetricRepository(storage).load());
    setWorkouts(createLocalWorkoutRepository(storage).load());
    setFoods(createLocalFoodEntryRepository(storage).load());
    setGoals(loadHealthGoals(storage));
    setNutritionGoals(loadNutritionGoals(storage));
    setTrainingProfile(loadTrainingProfile(storage));
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(dataChangedEventName, reload);
    return () => window.removeEventListener(dataChangedEventName, reload);
  }, [reload]);

  useEffect(() => {
    const refresh = () => void loadGoalImage().then(setGoalImage);
    refresh();
    window.addEventListener(goalImageChangedEvent, refresh);
    return () => window.removeEventListener(goalImageChangedEvent, refresh);
  }, []);

  async function handleGoalImage(file: File) {
    try {
      const dataUrl = await fileToDownscaledDataUrl(file, 768);
      await saveGoalImage(dataUrl);
      setGoalImage(dataUrl);
    } catch {
      // non-fatal
    }
  }

  const todayMetrics = useMemo(() => metrics.filter((entry) => entry.date === today), [metrics, today]);
  const bp = latestBloodPressure(todayMetrics) ?? latestBloodPressure(metrics);
  const glucose = latestGlucose(todayMetrics) ?? latestGlucose(metrics);
  const weight = latestWeight(metrics);
  const latestSleep = useMemo(() => {
    const withSleep = [...metrics]
      .filter((entry) => entry.sleepHours !== undefined)
      .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt))[0];
    return withSleep?.sleepHours;
  }, [metrics]);
  const fitness = useMemo(
    () =>
      getDailyFitnessStatus(
        workouts,
        today,
        trainingProfile ? workoutTypesForDate(trainingProfile, today) : undefined
      ),
    [workouts, today, trainingProfile]
  );

  const alignment = useMemo(
    () =>
      goals
        ? computeDailyAlignment({
            today,
            metrics,
            workouts,
            goals,
            foods,
            nutritionGoals: nutritionGoals ?? undefined,
            requiredWorkoutTypes: fitness.expectedTypes
          })
        : null,
    [goals, today, metrics, workouts, foods, nutritionGoals, fitness.expectedTypes]
  );

  if (!goals || !alignment) {
    return null;
  }

  const weightPercent = weightGoalProgressPercent(goals, weight?.weightLbs);
  const transformation = getTransformation({
    weightProgressPercent: weightPercent,
    alignmentPercent: alignment.percent
  });
  const levelInfo = levelFromJourney(transformation.progressPercent);

  function saveWeightGoal(current: HealthGoals) {
    const target = num(weightTargetDraft);
    if (!target) {
      setEditingWeight(false);
      return;
    }
    const next = withGoalEdits(current, {
      weightTargetLbs: target,
      // Anchor progress at the current weight (or an existing start) the first time.
      weightStartLbs: current.weightStartLbs ?? weight?.weightLbs ?? target
    });
    saveHealthGoals(window.localStorage, next);
    setGoals(next);
    setEditingWeight(false);
  }

  return (
    <section className="dashboard-section north-star" aria-label="North Star progress">
      <SectionHeader eyebrow="North Star" title="Becoming your future self" />

      <div className={`level-card level-card-stage-${transformation.stage}`}>
        <div className="level-evolution">
          <figure className="level-form level-form-current">
            <div className={`north-star-avatar-frame north-star-avatar-stage-${transformation.stage}`} aria-hidden="true">
              <CharacterSprite className="north-star-avatar-sprite" pose={STAGE_POSE[transformation.stage]} />
            </div>
            <figcaption>Lv {levelInfo.level} — now</figcaption>
          </figure>

          <div className="level-arrow" aria-hidden="true">▸</div>

          <figure className="level-form level-form-goal">
            <div className={levelInfo.isMaxLevel ? "level-goal-frame level-goal-frame-unlocked" : "level-goal-frame"}>
              {goalImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="level-goal-img" src={goalImage} alt="Your goal / final form" />
              ) : (
                <button
                  type="button"
                  className="level-goal-empty"
                  onClick={() => goalInputRef.current?.click()}
                >
                  + Set goal image
                </button>
              )}
            </div>
            <figcaption>Lv {levelInfo.maxLevel} — Patrick 2.0</figcaption>
          </figure>
          <input
            ref={goalInputRef}
            type="file"
            accept="image/*"
            className="visually-hidden"
            aria-label="Set your goal image"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleGoalImage(file);
              event.target.value = "";
            }}
          />
        </div>

        <div className="level-meter-block">
          <p className="level-headline">
            <strong>Lv {levelInfo.level}</strong>
            <span>/ {levelInfo.maxLevel}</span>
            <em>{levelInfo.title}</em>
          </p>
          <div className="north-star-meter level-xp" aria-label={`${levelInfo.percentIntoLevel}% to next level`}>
            <span style={{ width: `${levelInfo.isMaxLevel ? 100 : levelInfo.percentIntoLevel}%` }} />
          </div>
          <p className="reminders-help">
            {levelInfo.isMaxLevel
              ? "Max level — you're living as Patrick 2.0."
              : `${levelInfo.percentIntoLevel}% to Lv ${levelInfo.level + 1} · ${transformation.progressPercent}% of the whole journey`}
            {goalImage ? (
              <>
                {" "}
                ·{" "}
                <button type="button" className="level-change-goal" onClick={() => goalInputRef.current?.click()}>
                  change goal image
                </button>
              </>
            ) : null}
          </p>
        </div>
      </div>

      <div className="north-star-score">
        <div
          className={`north-star-dial north-star-dial-${alignment.level}`}
          role="img"
          aria-label={`Today's alignment ${alignment.percent} percent`}
        >
          <strong>{alignment.percent}</strong>
          <span>/100</span>
        </div>
        <div className="north-star-score-text">
          <p className="north-star-level">{alignment.label}</p>
          <p className="reminders-help">Today&apos;s alignment — vitals logged and in range, plus your three sessions.</p>
          <div className="north-star-meter" aria-hidden="true">
            <span style={{ width: `${alignment.percent}%` }} />
          </div>
        </div>
      </div>

      <ul className="north-star-rows">
        <li className="north-star-row">
          <span className="north-star-row-label">Weight</span>
          <span className="north-star-row-value">
            {weight ? `${weight.weightLbs} lb` : "Not logged"}
            {weight?.changeLbs !== undefined && weight.changeLbs !== 0
              ? ` (${weight.changeLbs > 0 ? "+" : ""}${weight.changeLbs})`
              : ""}
          </span>
          <span className="north-star-row-target">
            {goals.weightTargetLbs ? (
              <>
                → {goals.weightTargetLbs} lb
                {weightPercent !== undefined ? ` · ${weightPercent}%` : ""}
              </>
            ) : editingWeight ? (
              <span className="north-star-weight-edit">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  className="fitness-input"
                  placeholder="target lb"
                  value={weightTargetDraft}
                  onChange={(event) => setWeightTargetDraft(event.target.value)}
                />
                <button type="button" className="north-star-mini-btn" onClick={() => saveWeightGoal(goals)}>
                  Save
                </button>
              </span>
            ) : (
              <button type="button" className="north-star-mini-btn" onClick={() => setEditingWeight(true)}>
                Set goal
              </button>
            )}
          </span>
        </li>

        <li className="north-star-row">
          <span className="north-star-row-label">Blood pressure</span>
          <span className="north-star-row-value">
            {bp ? `${bp.systolic}/${bp.diastolic}` : "Not logged"}
          </span>
          <span className="north-star-row-target">
            {bp ? bloodPressureCategoryLabel[bp.category] : `target <${goals.bpSystolicTarget}/${goals.bpDiastolicTarget}`}
          </span>
        </li>

        <li className="north-star-row">
          <span className="north-star-row-label">Glucose</span>
          <span className="north-star-row-value">{glucose ? `${glucose.mgDl} mg/dL` : "Not logged"}</span>
          <span className="north-star-row-target">
            {glucose?.band ? glucoseBandLabel[glucose.band] : `target <${goals.fastingGlucoseTarget} fasting`}
          </span>
        </li>

        <li className="north-star-row">
          <span className="north-star-row-label">Sleep</span>
          <span className="north-star-row-value">
            {latestSleep !== undefined ? `${latestSleep}h` : "Not logged"}
          </span>
          <span className="north-star-row-target">target {goals.sleepHoursTarget}h</span>
        </li>

        <li className="north-star-row">
          <span className="north-star-row-label">Training today</span>
          <span className="north-star-row-value">
            {fitness.isRestDay ? "Recovery" : `${fitness.completedCount}/${fitness.expectedCount}`}
          </span>
          <span className="north-star-row-target">{fitness.isComplete ? "Complete ✓" : "In progress"}</span>
        </li>
      </ul>

      <div className="north-star-actions">
        <CommandButton href="/vitals" icon="metrics">
          Log vitals
        </CommandButton>
        <CommandButton href="/fitness" icon="metrics">
          Train
        </CommandButton>
      </div>
    </section>
  );
}
