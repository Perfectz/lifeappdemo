import { describe, expect, it } from "vitest";

import {
  normalizeOpenFoodFactsProduct,
  parseServingGrams,
  scaleMacros
} from "@/domain/foodSearch";

describe("food search normalization", () => {
  it("maps an Open Food Facts product to per-100g macros", () => {
    const item = normalizeOpenFoodFactsProduct({
      code: "123",
      product_name: "Greek Yogurt",
      brands: "Fage, Total",
      serving_size: "170 g",
      nutriments: {
        "energy-kcal_100g": 59,
        proteins_100g: 10,
        carbohydrates_100g: 3.6,
        fat_100g: 0.4,
        sugars_100g: 3.6,
        sodium_100g: 0.036
      }
    });
    expect(item).not.toBeNull();
    expect(item?.name).toBe("Greek Yogurt");
    expect(item?.brand).toBe("Fage");
    expect(item?.servingSizeG).toBe(170);
    expect(item?.per100g.calories).toBe(59);
    expect(item?.per100g.sodiumMg).toBe(36); // 0.036 g → 36 mg
  });

  it("derives sodium from salt when sodium is absent", () => {
    const item = normalizeOpenFoodFactsProduct({
      product_name: "Chips",
      nutriments: { "energy-kcal_100g": 536, salt_100g: 1.25 }
    });
    expect(item?.per100g.sodiumMg).toBe(500); // 1.25 / 2.5 * 1000
  });

  it("rejects products with no name or no nutrition", () => {
    expect(normalizeOpenFoodFactsProduct({ nutriments: { proteins_100g: 5 } })).toBeNull();
    expect(normalizeOpenFoodFactsProduct({ product_name: "Mystery", nutriments: {} })).toBeNull();
    expect(normalizeOpenFoodFactsProduct(null)).toBeNull();
  });

  it("parses serving grams from free text", () => {
    expect(parseServingGrams("30 g")).toBe(30);
    expect(parseServingGrams("1 cup (240 ml)")).toBeUndefined();
    expect(parseServingGrams(undefined)).toBeUndefined();
  });

  it("scales per-100g macros to a gram amount", () => {
    const scaled = scaleMacros(
      { calories: 200, proteinG: 10, carbsG: 20, fatG: 5, sodiumMg: 400 },
      50
    );
    expect(scaled.calories).toBe(100);
    expect(scaled.proteinG).toBe(5);
    expect(scaled.sodiumMg).toBe(200);
  });
});
