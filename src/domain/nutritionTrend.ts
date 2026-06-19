import type { FoodEntry, IsoDate } from "@/domain/types";
import { getFoodEntriesForDate, sumMacros } from "@/domain/nutrition";

/** Per-day nutrition totals over a window, plus averages across logged days. */

export type NutritionTrendPoint = {
  date: IsoDate;
  label: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sugarG: number;
  sodiumMg: number;
  logged: boolean;
};

export type NutritionTrend = {
  points: NutritionTrendPoint[];
  daysLogged: number;
  avgCalories?: number;
  avgProteinG?: number;
  avgCarbsG?: number;
  avgFatG?: number;
};

function shiftIso(iso: IsoDate, deltaDays: number): IsoDate {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() + deltaDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function average(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function getNutritionTrend(foods: FoodEntry[], today: IsoDate, days = 14): NutritionTrend {
  const points: NutritionTrendPoint[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = shiftIso(today, -offset);
    const dayEntries = getFoodEntriesForDate(foods, date);
    const totals = sumMacros(dayEntries);
    points.push({
      date,
      label: date.slice(5),
      calories: Math.round(totals.calories),
      proteinG: Math.round(totals.proteinG),
      carbsG: Math.round(totals.carbsG),
      fatG: Math.round(totals.fatG),
      sugarG: Math.round(totals.sugarG),
      sodiumMg: Math.round(totals.sodiumMg),
      logged: dayEntries.length > 0
    });
  }

  const loggedPoints = points.filter((point) => point.logged);
  return {
    points,
    daysLogged: loggedPoints.length,
    avgCalories: average(loggedPoints.map((p) => p.calories)),
    avgProteinG: average(loggedPoints.map((p) => p.proteinG)),
    avgCarbsG: average(loggedPoints.map((p) => p.carbsG)),
    avgFatG: average(loggedPoints.map((p) => p.fatG))
  };
}
