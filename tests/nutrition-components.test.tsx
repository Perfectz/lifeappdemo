import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { NutritionDiary } from "@/components/NutritionDiary";
import { foodEntryStorageKey } from "@/data/foodEntryRepository";
import { nutritionGoalsStorageKey } from "@/data/nutritionGoalsRepository";

describe("NutritionDiary", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("logs a food to a meal and updates totals", async () => {
    render(<NutritionDiary />);
    await waitFor(() => expect(screen.getByText("Breakfast")).toBeVisible());

    const breakfast = screen.getByLabelText("Breakfast");
    fireEvent.click(within(breakfast).getByRole("button", { name: "+ Add" }));

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
});
