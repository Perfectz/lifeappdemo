import { describe, expect, it } from "vitest";

import { parseMealEstimate, sumEstimateCalories } from "@/domain/mealEstimate";

describe("meal estimate parsing", () => {
  it("parses a well-formed itemized estimate", () => {
    const parsed = parseMealEstimate({
      summary: "Chicken, rice, and broccoli.",
      confidence: "medium",
      items: [
        { description: "Grilled chicken breast", calories: 280, proteinG: 52, carbsG: 0, fatG: 6 },
        { description: "1 cup white rice", calories: 205, proteinG: 4, carbsG: 45, fatG: 0 }
      ]
    });
    expect(parsed.confidence).toBe("medium");
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0].description).toBe("Grilled chicken breast");
    expect(sumEstimateCalories(parsed.items)).toBe(485);
  });

  it("accepts name/food aliases and drops items without a name", () => {
    const parsed = parseMealEstimate({
      items: [{ name: "Apple", calories: 95 }, { calories: 100 }, { food: "Latte", calories: 120 }]
    });
    expect(parsed.items.map((item) => item.description)).toEqual(["Apple", "Latte"]);
  });

  it("defaults confidence to low and tolerates garbage", () => {
    expect(parseMealEstimate(null).confidence).toBe("low");
    expect(parseMealEstimate({}).items).toEqual([]);
    expect(parseMealEstimate({ confidence: "wat", items: "no" }).confidence).toBe("low");
  });

  it("rounds and rejects negative macros", () => {
    const parsed = parseMealEstimate({ items: [{ description: "x", calories: 100.7, proteinG: -5 }] });
    expect(parsed.items[0].calories).toBe(101);
    expect(parsed.items[0].proteinG).toBeUndefined();
  });
});
