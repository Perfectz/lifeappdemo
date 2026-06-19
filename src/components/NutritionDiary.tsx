"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { playDing } from "@/client/sfx";
import { FoodSearch } from "@/components/FoodSearch";
import { MealPhotoLogger } from "@/components/MealPhotoLogger";
import { SectionHeader } from "@/components/SectionHeader";
import { dataChangedEventName } from "@/data/createLocalRepository";
import { createLocalFoodEntryRepository } from "@/data/foodEntryRepository";
import { loadNutritionGoals, saveNutritionGoals } from "@/data/nutritionGoalsRepository";
import { toLocalIsoDate } from "@/domain/dates";
import {
  caloriesRemaining,
  createFoodEntry,
  getFoodEntriesForDate,
  groupEntriesByMeal,
  mealTypes,
  sumMacros
} from "@/domain/nutrition";
import { withNutritionGoalEdits, type NutritionGoals } from "@/domain/nutritionGoals";
import type { FoodEntry, MealType } from "@/domain";

const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks"
};

function num(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function shiftIsoDate(deltaDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + deltaDays);
  return toLocalIsoDate(date);
}

const EMPTY_FORM = {
  description: "",
  calories: "",
  proteinG: "",
  carbsG: "",
  fatG: "",
  fiberG: "",
  sugarG: "",
  sodiumMg: ""
};

export function NutritionDiary() {
  const [foods, setFoods] = useState<FoodEntry[]>([]);
  const [goals, setGoals] = useState<NutritionGoals | null>(null);
  const [dayOffset, setDayOffset] = useState(0);
  const [addingMeal, setAddingMeal] = useState<MealType | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingGoals, setEditingGoals] = useState(false);
  const [goalDraft, setGoalDraft] = useState({ calorie: "", protein: "", carbs: "", fat: "" });
  const [error, setError] = useState<string | null>(null);

  const viewDate = useMemo(() => shiftIsoDate(dayOffset), [dayOffset]);
  const isToday = dayOffset === 0;

  const reload = useCallback(() => {
    const storage = window.localStorage;
    setFoods(createLocalFoodEntryRepository(storage).load());
    setGoals(loadNutritionGoals(storage));
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(dataChangedEventName, reload);
    return () => window.removeEventListener(dataChangedEventName, reload);
  }, [reload]);

  const dayEntries = useMemo(() => getFoodEntriesForDate(foods, viewDate), [foods, viewDate]);
  const byMeal = useMemo(() => groupEntriesByMeal(dayEntries), [dayEntries]);
  const totals = useMemo(() => sumMacros(dayEntries), [dayEntries]);
  const remaining = goals ? caloriesRemaining(goals.calorieTarget, totals.calories) : undefined;

  if (!goals) {
    return null;
  }

  function openAdd(meal: MealType) {
    setAddingMeal(meal);
    setForm({ ...EMPTY_FORM });
    setError(null);
  }

  function saveFood(meal: MealType) {
    const description = form.description.trim() || (num(form.calories) ? "Quick add" : "");
    if (!description) {
      setError("Add a description or some calories.");
      return;
    }
    try {
      const entry = createFoodEntry({
        date: viewDate,
        mealType: meal,
        description,
        macros: {
          calories: num(form.calories),
          proteinG: num(form.proteinG),
          carbsG: num(form.carbsG),
          fatG: num(form.fatG),
          fiberG: num(form.fiberG),
          sugarG: num(form.sugarG),
          sodiumMg: num(form.sodiumMg)
        },
        estimateSource: "manual"
      });
      const repo = createLocalFoodEntryRepository(window.localStorage);
      repo.save([entry, ...repo.load()]);
      setFoods(repo.load());
      setAddingMeal(null);
      setForm({ ...EMPTY_FORM });
      setError(null);
      playDing();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Couldn't save that food.");
    }
  }

  function removeFood(id: string) {
    const repo = createLocalFoodEntryRepository(window.localStorage);
    repo.save(repo.load().filter((entry) => entry.id !== id));
    setFoods(repo.load());
  }

  function openGoals() {
    setGoalDraft({
      calorie: goals?.calorieTarget?.toString() ?? "",
      protein: goals?.proteinTargetG?.toString() ?? "",
      carbs: goals?.carbsTargetG?.toString() ?? "",
      fat: goals?.fatTargetG?.toString() ?? ""
    });
    setEditingGoals(true);
  }

  function saveGoals(current: NutritionGoals) {
    const next = withNutritionGoalEdits(current, {
      calorieTarget: num(goalDraft.calorie) || undefined,
      proteinTargetG: num(goalDraft.protein) || undefined,
      carbsTargetG: num(goalDraft.carbs) || undefined,
      fatTargetG: num(goalDraft.fat) || undefined
    });
    saveNutritionGoals(window.localStorage, next);
    setGoals(next);
    setEditingGoals(false);
  }

  function macroBar(label: string, consumed: number, target: number | undefined) {
    const percent = target ? Math.min(100, Math.round((consumed / target) * 100)) : 0;
    return (
      <div className="nutri-macro">
        <span className="nutri-macro-label">{label}</span>
        <div className="nutri-macro-bar" aria-hidden="true">
          <span style={{ width: `${percent}%` }} />
        </div>
        <span className="nutri-macro-value">
          {Math.round(consumed)}
          {target ? ` / ${target}g` : "g"}
        </span>
      </div>
    );
  }

  return (
    <section className="nutrition-diary" aria-label="Nutrition diary">
      <div className="nutri-daybar">
        <button type="button" className="nutri-mini-btn" onClick={() => setDayOffset((o) => o - 1)}>
          ← Prev
        </button>
        <span className="nutri-daybar-date">{isToday ? "Today" : viewDate}</span>
        {isToday ? (
          <button type="button" className="nutri-mini-btn" onClick={() => setDayOffset((o) => o + 1)} disabled>
            Next →
          </button>
        ) : (
          <button type="button" className="nutri-mini-btn" onClick={() => setDayOffset(0)}>
            Today
          </button>
        )}
      </div>

      <section className="dashboard-section nutri-budget" aria-label="Calorie budget">
        <div className="nutri-budget-head">
          {goals.calorieTarget ? (
            <div className="nutri-budget-equation">
              <div>
                <strong>{goals.calorieTarget}</strong>
                <span>goal</span>
              </div>
              <span className="nutri-op">−</span>
              <div>
                <strong>{Math.round(totals.calories)}</strong>
                <span>food</span>
              </div>
              <span className="nutri-op">=</span>
              <div className={remaining !== undefined && remaining < 0 ? "nutri-remaining-over" : "nutri-remaining"}>
                <strong>{remaining}</strong>
                <span>{remaining !== undefined && remaining < 0 ? "over" : "left"}</span>
              </div>
            </div>
          ) : (
            <div className="nutri-budget-noset">
              <p>
                <strong>{Math.round(totals.calories)}</strong> calories today
              </p>
              <button type="button" className="nutri-mini-btn" onClick={openGoals}>
                Set a calorie goal
              </button>
            </div>
          )}
          {goals.calorieTarget ? (
            <button type="button" className="nutri-edit-goals" onClick={openGoals}>
              Edit goals
            </button>
          ) : null}
        </div>

        <div className="nutri-macros">
          {macroBar("Protein", totals.proteinG, goals.proteinTargetG)}
          {macroBar("Carbs", totals.carbsG, goals.carbsTargetG)}
          {macroBar("Fat", totals.fatG, goals.fatTargetG)}
        </div>

        <p className="nutri-micros">
          <span>Net carbs <strong>{Math.round(Math.max(0, totals.carbsG - totals.fiberG))}g</strong></span>
          <span>Sugar <strong>{Math.round(totals.sugarG)}g</strong></span>
          <span>Sodium <strong>{Math.round(totals.sodiumMg)}mg</strong></span>
        </p>

        {editingGoals ? (
          <div className="nutri-goal-editor">
            <label className="fitness-label">
              Calorie goal
              <input className="fitness-input" type="number" inputMode="numeric" min={0} value={goalDraft.calorie} onChange={(e) => setGoalDraft({ ...goalDraft, calorie: e.target.value })} />
            </label>
            <label className="fitness-label">
              Protein (g)
              <input className="fitness-input" type="number" inputMode="numeric" min={0} value={goalDraft.protein} onChange={(e) => setGoalDraft({ ...goalDraft, protein: e.target.value })} />
            </label>
            <label className="fitness-label">
              Carbs (g)
              <input className="fitness-input" type="number" inputMode="numeric" min={0} value={goalDraft.carbs} onChange={(e) => setGoalDraft({ ...goalDraft, carbs: e.target.value })} />
            </label>
            <label className="fitness-label">
              Fat (g)
              <input className="fitness-input" type="number" inputMode="numeric" min={0} value={goalDraft.fat} onChange={(e) => setGoalDraft({ ...goalDraft, fat: e.target.value })} />
            </label>
            <button type="button" className="login-submit" onClick={() => saveGoals(goals)}>
              <span>Save goals</span>
            </button>
          </div>
        ) : null}
      </section>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {mealTypes.map((meal) => {
        const entries = byMeal[meal];
        const mealCals = entries.reduce((sum, entry) => sum + (entry.macros.calories ?? 0), 0);
        return (
          <section className="dashboard-section nutri-meal" key={meal} aria-label={MEAL_LABEL[meal]}>
            <div className="nutri-meal-head">
              <SectionHeader eyebrow={`${Math.round(mealCals)} cal`} title={MEAL_LABEL[meal]} />
              <button type="button" className="nutri-mini-btn" onClick={() => openAdd(meal)}>
                + Add
              </button>
            </div>

            {entries.length > 0 ? (
              <ul className="nutri-entries">
                {entries.map((entry) => (
                  <li className="nutri-entry" key={entry.id}>
                    <div>
                      <strong>{entry.description}</strong>
                      <small>
                        {[
                          entry.macros.calories ? `${Math.round(entry.macros.calories)} cal` : null,
                          entry.macros.proteinG ? `${Math.round(entry.macros.proteinG)}p` : null,
                          entry.macros.carbsG ? `${Math.round(entry.macros.carbsG)}c` : null,
                          entry.macros.fatG ? `${Math.round(entry.macros.fatG)}f` : null,
                          entry.estimateSource === "photo_ai" ? "AI" : null
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </div>
                    <button type="button" className="nutri-remove" aria-label={`Remove ${entry.description}`} onClick={() => removeFood(entry.id)}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {addingMeal === meal ? (
              <div className="nutri-add-form">
                <input className="fitness-input" placeholder="Food description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <div className="nutri-add-grid">
                  <input className="fitness-input" type="number" inputMode="numeric" min={0} placeholder="cal" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} />
                  <input className="fitness-input" type="number" inputMode="numeric" min={0} placeholder="protein" value={form.proteinG} onChange={(e) => setForm({ ...form, proteinG: e.target.value })} />
                  <input className="fitness-input" type="number" inputMode="numeric" min={0} placeholder="carbs" value={form.carbsG} onChange={(e) => setForm({ ...form, carbsG: e.target.value })} />
                  <input className="fitness-input" type="number" inputMode="numeric" min={0} placeholder="fat" value={form.fatG} onChange={(e) => setForm({ ...form, fatG: e.target.value })} />
                  <input className="fitness-input" type="number" inputMode="numeric" min={0} placeholder="sugar" value={form.sugarG} onChange={(e) => setForm({ ...form, sugarG: e.target.value })} />
                  <input className="fitness-input" type="number" inputMode="numeric" min={0} placeholder="sodium(mg)" value={form.sodiumMg} onChange={(e) => setForm({ ...form, sodiumMg: e.target.value })} />
                </div>
                <div className="nutri-add-actions">
                  <button type="button" className="login-submit" onClick={() => saveFood(meal)}>
                    <span>Add to {MEAL_LABEL[meal]}</span>
                  </button>
                  <button type="button" className="nutri-mini-btn" onClick={() => setAddingMeal(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {entries.length === 0 && addingMeal !== meal ? (
              <p className="reminders-help">Nothing logged.</p>
            ) : null}
          </section>
        );
      })}

      <FoodSearch date={viewDate} />
      <MealPhotoLogger date={viewDate} />
    </section>
  );
}
