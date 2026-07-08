import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { NutritionDiary } from "@/components/NutritionDiary";
import { foodEntryStorageKey } from "@/data/foodEntryRepository";
import { nutritionGoalsStorageKey } from "@/data/nutritionGoalsRepository";
import { toLocalIsoDate } from "@/domain/dates";
import { createFoodEntry } from "@/domain/nutrition";
import type { FoodEntry, IsoDate, Macros, MealType } from "@/domain/types";

function isoDaysAgo(days: number): IsoDate {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toLocalIsoDate(date);
}

function seedFoodEntries(
  rows: { date: IsoDate; mealType: MealType; description: string; macros?: Macros }[]
): FoodEntry[] {
  const entries = rows.map((row) => createFoodEntry(row, `${row.date}T12:00:00.000Z`));
  window.localStorage.setItem(foodEntryStorageKey, JSON.stringify(entries));
  return entries;
}

describe("NutritionDiary", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("logs a food to a meal and updates totals", async () => {
    render(<NutritionDiary />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Breakfast" })).toBeVisible());

    const breakfast = screen.getByLabelText("Breakfast");
    fireEvent.click(within(breakfast).getByRole("button", { name: "Add food to Breakfast" }));

    fireEvent.change(within(breakfast).getByPlaceholderText("Food description"), {
      target: { value: "Oatmeal" }
    });
    fireEvent.change(within(breakfast).getByPlaceholderText("cal"), { target: { value: "350" } });
    fireEvent.click(within(breakfast).getByRole("button", { name: "Add to Breakfast" }));

    await waitFor(() => expect(screen.getByText("Oatmeal")).toBeVisible());

    const stored = JSON.parse(window.localStorage.getItem(foodEntryStorageKey) ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ mealType: "breakfast", description: "Oatmeal" });
    expect(stored[0].macros.calories).toBe(350);
  });

  it("sets a calorie goal and shows the remaining budget", async () => {
    render(<NutritionDiary />);
    await waitFor(() => expect(screen.getByText("Set a calorie goal")).toBeVisible());

    fireEvent.click(screen.getByRole("button", { name: "Set a calorie goal" }));
    fireEvent.change(screen.getByLabelText("Calorie goal"), { target: { value: "2000" } });
    fireEvent.click(screen.getByRole("button", { name: "Save goals" }));

    await waitFor(() => expect(screen.getByText("goal")).toBeVisible());
    expect(screen.getByText("left")).toBeVisible();

    const storedGoals = JSON.parse(window.localStorage.getItem(nutritionGoalsStorageKey) ?? "{}");
    expect(storedGoals.calorieTarget).toBe(2000);
  });

  it("quick-adds a recently logged food with one tap", async () => {
    seedFoodEntries([
      {
        date: isoDaysAgo(1),
        mealType: "dinner",
        description: "Chicken bowl",
        macros: { calories: 600, proteinG: 45 }
      }
    ]);

    render(<NutritionDiary />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Lunch" })).toBeVisible());

    const lunch = screen.getByLabelText("Lunch");
    fireEvent.click(within(lunch).getByRole("button", { name: "Add food to Lunch" }));

    expect(within(lunch).getByText("Quick add · Recent")).toBeVisible();
    fireEvent.click(within(lunch).getByRole("button", { name: /Chicken bowl/ }));

    await waitFor(() => expect(within(lunch).getByText("Chicken bowl")).toBeVisible());

    const stored = JSON.parse(
      window.localStorage.getItem(foodEntryStorageKey) ?? "[]"
    ) as FoodEntry[];
    const today = stored.filter((entry) => entry.date === toLocalIsoDate());
    expect(today).toHaveLength(1);
    expect(today[0]).toMatchObject({ mealType: "lunch", description: "Chicken bowl" });
    expect(today[0].macros.calories).toBe(600);
  });

  it("hides the quick-add strip when there is no history", async () => {
    render(<NutritionDiary />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Breakfast" })).toBeVisible());

    const breakfast = screen.getByLabelText("Breakfast");
    fireEvent.click(within(breakfast).getByRole("button", { name: "Add food to Breakfast" }));

    expect(screen.queryByText(/Quick add ·/)).toBeNull();
  });

  it("copies yesterday's meal into today with fresh ids", async () => {
    const [yesterdayEntry] = seedFoodEntries([
      {
        date: isoDaysAgo(1),
        mealType: "breakfast",
        description: "Oatmeal",
        macros: { calories: 350 }
      }
    ]);

    render(<NutritionDiary />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Breakfast" })).toBeVisible());

    const breakfast = screen.getByLabelText("Breakfast");
    fireEvent.click(within(breakfast).getByRole("button", { name: "Copy yesterday's Breakfast" }));

    await waitFor(() => expect(within(breakfast).getByText("Oatmeal")).toBeVisible());

    const stored = JSON.parse(
      window.localStorage.getItem(foodEntryStorageKey) ?? "[]"
    ) as FoodEntry[];
    const today = stored.filter((entry) => entry.date === toLocalIsoDate());
    expect(today).toHaveLength(1);
    expect(today[0].id).not.toBe(yesterdayEntry.id);
    expect(today[0].macros.calories).toBe(350);
    // The per-meal copy affordance disappears once today's meal has entries.
    expect(screen.queryByRole("button", { name: "Copy yesterday's Breakfast" })).toBeNull();
  });

  it("copies all of yesterday when today is empty", async () => {
    seedFoodEntries([
      { date: isoDaysAgo(1), mealType: "breakfast", description: "Oatmeal", macros: { calories: 350 } },
      { date: isoDaysAgo(1), mealType: "dinner", description: "Chicken bowl", macros: { calories: 600 } }
    ]);

    render(<NutritionDiary />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Copy all of yesterday/ })).toBeVisible()
    );

    fireEvent.click(screen.getByRole("button", { name: /Copy all of yesterday/ }));

    await waitFor(() => {
      const stored = JSON.parse(
        window.localStorage.getItem(foodEntryStorageKey) ?? "[]"
      ) as FoodEntry[];
      expect(stored.filter((entry) => entry.date === toLocalIsoDate())).toHaveLength(2);
    });
    // Day-level copy disappears once today has entries.
    expect(screen.queryByRole("button", { name: /Copy all of yesterday/ })).toBeNull();
  });
});
