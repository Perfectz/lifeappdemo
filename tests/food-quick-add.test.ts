import { describe, expect, it } from "vitest";

import {
  buildQuickAddSuggestions,
  copyEntriesToDate,
  frequentFoods,
  previousIsoDate,
  recentFoods
} from "@/domain/foodQuickAdd";
import { createFoodEntry } from "@/domain/nutrition";
import type { FoodEntry, IsoDate, MealType } from "@/domain/types";

const TODAY: IsoDate = "2026-07-08";

function entry(
  date: IsoDate,
  description: string,
  calories: number,
  overrides: { mealType?: MealType; time?: string; proteinG?: number } = {}
): FoodEntry {
  return createFoodEntry(
    {
      date,
      mealType: overrides.mealType ?? "lunch",
      description,
      macros: { calories, proteinG: overrides.proteinG }
    },
    `${date}T${overrides.time ?? "12:00:00"}.000Z`
  );
}

describe("recentFoods", () => {
  it("returns unique foods from the window, most recent first, excluding today", () => {
    const entries = [
      entry(TODAY, "Today Salad", 300),
      entry("2026-07-07", "Chicken bowl", 600, { mealType: "dinner" }),
      entry("2026-07-05", "Oatmeal", 350, { mealType: "breakfast" }),
      entry("2026-07-01", "Chicken bowl", 600), // dupe of the 07-07 one
      entry("2026-06-20", "Too old", 200) // outside the 14-day window
    ];

    const recent = recentFoods(entries, { today: TODAY });

    expect(recent.map((item) => item.name)).toEqual(["Chicken bowl", "Oatmeal"]);
    expect(recent[0]).toMatchObject({ calories: 600, lastMeal: "dinner" });
    expect(recent[1].macros.calories).toBe(350);
  });

  it("dedupes case- and whitespace-insensitively but keeps distinct calories apart", () => {
    const entries = [
      entry("2026-07-07", "Greek  Yogurt", 150),
      entry("2026-07-06", "greek yogurt", 150),
      entry("2026-07-05", "Greek yogurt", 300) // different portion → separate template
    ];

    const recent = recentFoods(entries, { today: TODAY });

    expect(recent).toHaveLength(2);
    expect(recent[0].name).toBe("Greek  Yogurt"); // most recent occurrence wins
    expect(recent.map((item) => item.calories)).toEqual([150, 300]);
  });

  it("respects the limit and returns nothing for empty history", () => {
    const entries = Array.from({ length: 12 }, (_, i) =>
      entry("2026-07-07", `Food ${i}`, 100 + i)
    );
    expect(recentFoods(entries, { today: TODAY, limit: 3 })).toHaveLength(3);
    expect(recentFoods([], { today: TODAY })).toEqual([]);
  });
});

describe("frequentFoods", () => {
  it("requires at least two occurrences and ranks by count", () => {
    const entries = [
      entry("2026-07-07", "Coffee", 5),
      entry("2026-07-06", "Coffee", 5),
      entry("2026-07-05", "Coffee", 5),
      entry("2026-07-04", "Eggs", 210),
      entry("2026-07-02", "Eggs", 210),
      entry("2026-07-01", "One-off pizza", 900)
    ];

    const frequent = frequentFoods(entries, { today: TODAY });

    expect(frequent.map((item) => item.name)).toEqual(["Coffee", "Eggs"]);
    expect(frequent.some((item) => item.name === "One-off pizza")).toBe(false);
  });

  it("ignores entries outside the trailing window", () => {
    const entries = [
      entry("2026-05-01", "Old habit", 400),
      entry("2026-05-02", "Old habit", 400)
    ];
    expect(frequentFoods(entries, { today: TODAY, days: 45 })).toEqual([]);
  });

  it("counts today's entries toward frequency", () => {
    const entries = [entry(TODAY, "Shake", 250), entry("2026-07-06", "Shake", 250)];
    const frequent = frequentFoods(entries, { today: TODAY });
    expect(frequent.map((item) => item.name)).toEqual(["Shake"]);
  });
});

describe("buildQuickAddSuggestions", () => {
  it("dedupes frequent against recent", () => {
    const entries = [
      entry("2026-07-07", "Chicken bowl", 600), // recent AND frequent
      entry("2026-07-04", "Chicken bowl", 600),
      // Frequent-only: last logged outside the 14-day recent window.
      entry("2026-06-10", "Protein bar", 200),
      entry("2026-06-08", "Protein bar", 200)
    ];

    const { recent, frequent } = buildQuickAddSuggestions(entries, { today: TODAY });

    expect(recent.map((item) => item.name)).toContain("Chicken bowl");
    expect(frequent.map((item) => item.name)).toEqual(["Protein bar"]);
  });

  it("returns empty strips for empty history", () => {
    expect(buildQuickAddSuggestions([], { today: TODAY })).toEqual({ recent: [], frequent: [] });
  });
});

describe("copyEntriesToDate", () => {
  it("creates fresh entries on the target date with new ids and same macros", () => {
    const yesterday = [
      entry("2026-07-07", "Oatmeal", 350, { mealType: "breakfast", proteinG: 12 }),
      entry("2026-07-07", "Chicken bowl", 600, { mealType: "dinner" })
    ];

    const copied = copyEntriesToDate(yesterday, TODAY, "2026-07-08T08:00:00.000Z");

    expect(copied).toHaveLength(2);
    for (const [index, copy] of copied.entries()) {
      expect(copy.date).toBe(TODAY);
      expect(copy.id).not.toBe(yesterday[index].id);
      expect(copy.description).toBe(yesterday[index].description);
      expect(copy.macros).toEqual(yesterday[index].macros);
      expect(copy.mealType).toBe(yesterday[index].mealType);
      expect(copy.recordedAt).toBe("2026-07-08T08:00:00.000Z");
    }
    const ids = new Set(copied.map((copy) => copy.id));
    expect(ids.size).toBe(copied.length);
    // Originals are untouched.
    expect(yesterday[0].date).toBe("2026-07-07");
  });

  it("does not carry photo refs onto the copy", () => {
    const source = createFoodEntry(
      {
        date: "2026-07-07",
        mealType: "lunch",
        description: "Photo lunch",
        macros: { calories: 500 },
        estimateSource: "photo_ai",
        photoRef: "photo-123"
      },
      "2026-07-07T12:00:00.000Z"
    );
    const [copy] = copyEntriesToDate([source], TODAY);
    expect(copy.photoRef).toBeUndefined();
    expect(copy.estimateSource).toBe("photo_ai");
  });
});

describe("previousIsoDate", () => {
  it("steps back one calendar day, across month boundaries", () => {
    expect(previousIsoDate("2026-07-08")).toBe("2026-07-07");
    expect(previousIsoDate("2026-07-01")).toBe("2026-06-30");
    expect(previousIsoDate("2026-01-01")).toBe("2025-12-31");
  });
});
