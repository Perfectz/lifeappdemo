"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { readProfile, writeHeroName } from "@/client/profile";
import { SectionHeader } from "@/components/SectionHeader";
import { createLocalMetricRepository } from "@/data/metricRepository";
import { createLocalGoalRepository } from "@/data/goalRepository";
import { loadBodyProfile, saveBodyProfile } from "@/data/bodyProfileRepository";
import { loadHealthGoals, saveHealthGoals } from "@/data/healthGoalsRepository";
import { loadNutritionGoals, saveNutritionGoals } from "@/data/nutritionGoalsRepository";
import { loadTrainingProfile, saveTrainingProfile } from "@/data/trainingProfileRepository";
import { withBodyProfileEdits } from "@/domain/bodyProfile";
import {
  activityLevelLabel,
  activityLevels,
  computeCalorieBudget,
  type ActivityLevel,
  type BiologicalSex,
  type CalorieBudget
} from "@/domain/calorieBudget";
import { toLocalIsoDate } from "@/domain/dates";
import { createGoal } from "@/domain/goals";
import { withGoalEdits } from "@/domain/healthGoals";
import { createMetricEntry } from "@/domain/metrics";
import { withNutritionGoalEdits } from "@/domain/nutritionGoals";
import { balancedWeeklySchedule } from "@/domain/trainingProfile";

function num(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function SetupWizard() {
  const router = useRouter();
  const [name, setName] = useState(() => readProfile().heroName);
  const [sex, setSex] = useState<BiologicalSex>("male");
  const [age, setAge] = useState("");
  const [feet, setFeet] = useState("");
  const [inches, setInches] = useState("");
  const [activity, setActivity] = useState<ActivityLevel>("light");
  const [currentWeight, setCurrentWeight] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [primaryGoal, setPrimaryGoal] = useState("");
  const [trainingSchedule, setTrainingSchedule] = useState<"balanced" | "daily">("balanced");
  const [constraints, setConstraints] = useState("");
  const [budget, setBudget] = useState<CalorieBudget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function heightInches(): number | undefined {
    const ft = num(feet) ?? 0;
    const inch = Number(inches) || 0;
    const total = ft * 12 + inch;
    return total > 0 ? total : undefined;
  }

  function calculate() {
    const ageN = num(age);
    const heightN = heightInches();
    const weightN = num(currentWeight);
    if (!ageN || !heightN || !weightN) {
      setError("Add your age, height, and current weight to calculate a budget.");
      return;
    }
    setError(null);
    setBudget(
      computeCalorieBudget({
        sex,
        age: ageN,
        heightInches: heightN,
        weightLbs: weightN,
        targetWeightLbs: num(targetWeight),
        activityLevel: activity,
        goal: num(targetWeight) && num(targetWeight)! < weightN ? "lose" : "maintain"
      })
    );
  }

  function finish() {
    const weightN = num(currentWeight);
    const heightN = heightInches();
    setSaving(true);
    try {
      const storage = window.localStorage;
      const now = new Date().toISOString();

      writeHeroName(name);

      if (primaryGoal.trim()) {
        const goalRepository = createLocalGoalRepository(storage);
        const existingGoals = goalRepository.load();
        if (!existingGoals.some((goal) => goal.title.toLowerCase() === primaryGoal.trim().toLowerCase())) {
          goalRepository.save([
            createGoal({
              title: primaryGoal,
              pillar: "fitness",
              horizon: "quarterly",
              description: "Primary outcome chosen during setup."
            }),
            ...existingGoals
          ]);
        }
      }

      saveBodyProfile(
        storage,
        withBodyProfileEdits(loadBodyProfile(storage), {
          sex,
          age: num(age),
          heightInches: heightN,
          activityLevel: activity,
          setupCompleted: true
        })
      );

      saveHealthGoals(
        storage,
        withGoalEdits(loadHealthGoals(storage), {
          weightStartLbs: weightN,
          weightTargetLbs: num(targetWeight)
        })
      );

      const currentTrainingProfile = loadTrainingProfile(storage);
      saveTrainingProfile(storage, {
        ...currentTrainingProfile,
        weeklySchedule: trainingSchedule === "balanced" ? balancedWeeklySchedule() : undefined,
        notes: constraints.trim() || currentTrainingProfile.notes,
        updatedAt: now
      });

      if (budget) {
        saveNutritionGoals(
          storage,
          withNutritionGoalEdits(loadNutritionGoals(storage), {
            calorieTarget: budget.recommendedCalories,
            proteinTargetG: budget.proteinTargetG,
            carbsTargetG: budget.carbsTargetG,
            fatTargetG: budget.fatTargetG
          })
        );
      }

      // Seed today's weight so progress + North Star have a starting point.
      if (weightN) {
        const repo = createLocalMetricRepository(storage);
        repo.save([
          createMetricEntry({ date: toLocalIsoDate(), checkInType: "morning", weightLbs: weightN }, now),
          ...repo.load()
        ]);
      }

      router.push("/dashboard");
    } catch (saveError) {
      setSaving(false);
      setError(saveError instanceof Error ? saveError.message : "Couldn't save your setup.");
    }
  }

  return (
    <section className="dashboard-section setup-wizard" aria-label="First-time setup">
      <SectionHeader eyebrow="Welcome" title="Set up your plan" />
      <p className="reminders-help">
        Two minutes now makes the dashboard, goals, and nutrition budget work for you. You can change
        any of this later.
      </p>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <label className="fitness-label">
        What should the coach call you?
        <input className="fitness-input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <label className="fitness-label">
        What outcome matters most right now?
        <input
          className="fitness-input"
          placeholder="e.g. Reach 180 lb while keeping my strength"
          value={primaryGoal}
          onChange={(event) => setPrimaryGoal(event.target.value)}
        />
      </label>

      <div className="setup-grid">
        <label className="fitness-label">
          Sex (for calorie math)
          <select className="fitness-input" value={sex} onChange={(e) => setSex(e.target.value as BiologicalSex)}>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
        <label className="fitness-label">
          Age
          <input className="fitness-input" type="number" inputMode="numeric" min={1} value={age} onChange={(e) => setAge(e.target.value)} />
        </label>
        <label className="fitness-label">
          Height (ft)
          <input className="fitness-input" type="number" inputMode="numeric" min={1} value={feet} onChange={(e) => setFeet(e.target.value)} />
        </label>
        <label className="fitness-label">
          Height (in)
          <input className="fitness-input" type="number" inputMode="numeric" min={0} value={inches} onChange={(e) => setInches(e.target.value)} />
        </label>
        <label className="fitness-label">
          Current weight (lb)
          <input className="fitness-input" type="number" inputMode="decimal" min={1} value={currentWeight} onChange={(e) => setCurrentWeight(e.target.value)} />
        </label>
        <label className="fitness-label">
          Target weight (lb)
          <input className="fitness-input" type="number" inputMode="decimal" min={1} value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} />
        </label>
        <label className="fitness-label setup-activity">
          Activity level
          <select className="fitness-input" value={activity} onChange={(e) => setActivity(e.target.value as ActivityLevel)}>
            {activityLevels.map((level) => (
              <option key={level} value={level}>
                {activityLevelLabel[level]}
              </option>
            ))}
          </select>
        </label>
        <label className="fitness-label setup-activity">
          Training rhythm
          <select
            className="fitness-input"
            value={trainingSchedule}
            onChange={(event) => setTrainingSchedule(event.target.value as "balanced" | "daily")}
          >
            <option value="balanced">Balanced week with a recovery day</option>
            <option value="daily">Legacy three-session daily target</option>
          </select>
        </label>
      </div>

      <label className="fitness-label">
        Injuries, schedule limits, or equipment constraints — optional
        <textarea
          className="fitness-input"
          rows={3}
          placeholder="The coach will plan around this context."
          value={constraints}
          onChange={(event) => setConstraints(event.target.value)}
        />
      </label>

      <button type="button" className="nutri-mini-btn" onClick={calculate}>
        Calculate my calorie budget
      </button>

      {budget ? (
        <div className="setup-budget" role="status">
          <p>
            Suggested daily budget: <strong>{budget.recommendedCalories} cal</strong>{" "}
            <span className="reminders-help">(TDEE ~{budget.tdee})</span>
          </p>
          <p className="reminders-help">
            Protein {budget.proteinTargetG}g · Carbs {budget.carbsTargetG}g · Fat {budget.fatTargetG}g — you can fine-tune these in Nutrition.
          </p>
        </div>
      ) : null}

      <button type="button" className="login-submit setup-finish" onClick={finish} disabled={saving}>
        <span>{saving ? "Saving…" : budget ? "Save & finish" : "Skip budget & finish"}</span>
      </button>

      <p className="health-boundary">
        Calorie and macro suggestions are general estimates, not medical or dietetic advice.
      </p>
    </section>
  );
}
