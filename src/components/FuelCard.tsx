"use client";

import { useCallback, useEffect, useState } from "react";

import { CommandButton } from "@/components/CommandButton";
import { SectionHeader } from "@/components/SectionHeader";
import { dataChangedEventName } from "@/data/createLocalRepository";
import { getTargetForDate } from "@/data/dailyNutritionTargetRepository";
import { createLocalFoodEntryRepository } from "@/data/foodEntryRepository";
import type { Macros } from "@/domain";
import type { DailyNutritionTarget } from "@/domain/dailyNutritionTarget";
import { toLocalIsoDate } from "@/domain/dates";
import { getFoodEntriesForDate, sumMacros } from "@/domain/nutrition";

const EMPTY_TOTALS: Required<Macros> = {
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  sugarG: 0,
  sodiumMg: 0
};

/**
 * Health-first dashboard card: today's fuel (calories + macros) versus the
 * stored daily nutrition target. Self-loading like VitalsAlertBanner — reads
 * the local repositories directly and refreshes on any data change. Reads
 * ONLY the already-stored target for today; it never triggers the AI target
 * computation (that stays on the nutrition screens).
 */
export function FuelCard() {
  const [totals, setTotals] = useState<Required<Macros>>(EMPTY_TOTALS);
  const [target, setTarget] = useState<DailyNutritionTarget | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const reload = useCallback(() => {
    const storage = window.localStorage;
    const today = toLocalIsoDate();
    const entries = getFoodEntriesForDate(createLocalFoodEntryRepository(storage).load(), today);
    setTotals(sumMacros(entries));
    setTarget(getTargetForDate(storage, today) ?? null);
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener(dataChangedEventName, reload);
    return () => window.removeEventListener(dataChangedEventName, reload);
  }, [reload]);

  const consumed = Math.round(totals.calories);
  const overTarget = target !== null && consumed > target.calorieTarget;
  const percent =
    target !== null && target.calorieTarget > 0
      ? Math.min(100, Math.round((consumed / target.calorieTarget) * 100))
      : 0;

  const macroRows =
    target !== null
      ? [
          { label: "Protein", consumed: Math.round(totals.proteinG), targetG: target.proteinTargetG },
          { label: "Carbs", consumed: Math.round(totals.carbsG), targetG: target.carbsTargetG },
          { label: "Fat", consumed: Math.round(totals.fatG), targetG: target.fatTargetG }
        ]
      : [];

  return (
    <section className="dashboard-section fuel-card" aria-label="Today's fuel">
      <SectionHeader eyebrow="Fuel" title="Today's Fuel" />
      {hasLoaded && target !== null ? (
        <>
          <p className="fuel-calories">
            <strong>
              {consumed} / {target.calorieTarget} kcal
            </strong>
            <span>{overTarget ? "over target" : `${percent}% of target`}</span>
          </p>
          <div
            className={overTarget ? "progress-meter fuel-meter fuel-meter-over" : "progress-meter fuel-meter"}
            aria-label={`Calories ${consumed} of ${target.calorieTarget}`}
          >
            <span style={{ width: `${percent}%` }} />
          </div>
          <ul className="fuel-macros">
            {macroRows.map((row) => (
              <li
                key={row.label}
                className={row.consumed > row.targetG ? "fuel-macro-row fuel-macro-over" : "fuel-macro-row"}
              >
                <span>{row.label}</span>
                <strong>
                  {row.consumed} / {row.targetG} g
                </strong>
              </li>
            ))}
          </ul>
          <div className="dashboard-card-cta">
            <CommandButton href="/nutrition" icon="metrics">
              Open Nutrition
            </CommandButton>
          </div>
        </>
      ) : null}
      {hasLoaded && target === null ? (
        <div className="dashboard-empty dashboard-empty-action">
          <strong>No calorie goal for today yet.</strong>
          <p>Open the nutrition diary to set today&apos;s calorie and macro targets.</p>
          <CommandButton href="/nutrition" icon="metrics">
            Set your calorie goal
          </CommandButton>
        </div>
      ) : null}
    </section>
  );
}
