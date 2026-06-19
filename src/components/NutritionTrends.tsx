"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { SectionHeader } from "@/components/SectionHeader";
import { dataChangedEventName } from "@/data/createLocalRepository";
import { createLocalFoodEntryRepository } from "@/data/foodEntryRepository";
import { loadNutritionGoals } from "@/data/nutritionGoalsRepository";
import { toLocalIsoDate } from "@/domain/dates";
import { getNutritionTrend } from "@/domain/nutritionTrend";
import type { FoodEntry } from "@/domain";
import type { NutritionGoals } from "@/domain/nutritionGoals";

export function NutritionTrends() {
  const [foods, setFoods] = useState<FoodEntry[]>([]);
  const [goals, setGoals] = useState<NutritionGoals | null>(null);
  const today = toLocalIsoDate();

  const reload = useCallback(() => {
    setFoods(createLocalFoodEntryRepository(window.localStorage).load());
    setGoals(loadNutritionGoals(window.localStorage));
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(dataChangedEventName, reload);
    return () => window.removeEventListener(dataChangedEventName, reload);
  }, [reload]);

  const trend = useMemo(() => getNutritionTrend(foods, today, 14), [foods, today]);
  const maxCalories = useMemo(
    () => Math.max(1, ...trend.points.map((point) => point.calories)),
    [trend]
  );

  if (trend.daysLogged === 0) {
    return null;
  }

  const target = goals?.calorieTarget;

  return (
    <section className="dashboard-section nutrition-trends" aria-label="Nutrition trends">
      <SectionHeader eyebrow="Nutrition" title="14-day calories & macros" />

      <div className="nutri-trend-chart" role="img" aria-label="Daily calories, last 14 days">
        {trend.points.map((point) => {
          const heightPct = Math.round((point.calories / maxCalories) * 100);
          const over = target !== undefined && point.calories > target;
          return (
            <div className="nutri-trend-col" key={point.date} title={`${point.label}: ${point.calories} cal`}>
              <div className="nutri-trend-bar-track">
                <span
                  className={over ? "nutri-trend-bar nutri-trend-bar-over" : "nutri-trend-bar"}
                  style={{ height: `${point.logged ? Math.max(2, heightPct) : 0}%` }}
                />
              </div>
              <span className="nutri-trend-label">{point.label.replace("-", "/")}</span>
            </div>
          );
        })}
      </div>

      <div className="nutri-trend-averages">
        <span>Avg calories <strong>{trend.avgCalories ?? "—"}</strong></span>
        <span>Protein <strong>{trend.avgProteinG ?? "—"}g</strong></span>
        <span>Carbs <strong>{trend.avgCarbsG ?? "—"}g</strong></span>
        <span>Fat <strong>{trend.avgFatG ?? "—"}g</strong></span>
        <span className="reminders-help">over {trend.daysLogged} logged day{trend.daysLogged === 1 ? "" : "s"}</span>
      </div>
    </section>
  );
}
