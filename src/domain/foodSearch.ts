import type { Macros } from "@/domain/types";

/**
 * Food-database search results (Open Food Facts). Normalization lives here as a
 * pure function so it's fully testable without network; the server module does
 * the fetch and maps each raw product through this.
 */

export type FoodSearchItem = {
  /** Barcode / product code. */
  code: string;
  name: string;
  brand?: string;
  /** Macros per 100 g, the OFF reference basis. */
  per100g: Macros;
  /** Grams in one serving, when the product declares it. */
  servingSizeG?: number;
};

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

function round(value: number | undefined): number | undefined {
  return value === undefined ? undefined : Math.round(value);
}

/** Parse a grams figure from an OFF serving_size like "30 g" or "1 cup (240 ml)". */
export function parseServingGrams(servingSize: unknown): number | undefined {
  if (typeof servingSize !== "string") return undefined;
  const match = /([\d.]+)\s*g\b/i.exec(servingSize);
  if (!match) return undefined;
  const grams = Number(match[1]);
  return Number.isFinite(grams) && grams > 0 ? grams : undefined;
}

/** Map a raw Open Food Facts product to a FoodSearchItem, or null if unusable. */
export function normalizeOpenFoodFactsProduct(raw: unknown): FoodSearchItem | null {
  if (!raw || typeof raw !== "object") return null;
  const product = raw as Record<string, unknown>;
  const code = typeof product.code === "string" ? product.code : "";
  const name =
    (typeof product.product_name === "string" && product.product_name.trim()) ||
    (typeof product.generic_name === "string" && product.generic_name.trim()) ||
    "";
  if (!name) return null;

  const nutriments = (product.nutriments && typeof product.nutriments === "object"
    ? product.nutriments
    : {}) as Record<string, unknown>;

  // Sodium: OFF gives sodium_100g in grams; fall back to salt/2.5.
  const sodiumG = asNumber(nutriments["sodium_100g"]);
  const saltG = asNumber(nutriments["salt_100g"]);
  const sodiumMg =
    sodiumG !== undefined ? sodiumG * 1000 : saltG !== undefined ? (saltG / 2.5) * 1000 : undefined;

  const per100g: Macros = {
    calories: round(asNumber(nutriments["energy-kcal_100g"])),
    proteinG: round(asNumber(nutriments["proteins_100g"])),
    carbsG: round(asNumber(nutriments["carbohydrates_100g"])),
    fatG: round(asNumber(nutriments["fat_100g"])),
    fiberG: round(asNumber(nutriments["fiber_100g"])),
    sugarG: round(asNumber(nutriments["sugars_100g"])),
    sodiumMg: round(sodiumMg)
  };

  // Skip products with no usable nutrition at all.
  const hasAnyMacro = Object.values(per100g).some((value) => value !== undefined);
  if (!hasAnyMacro) return null;

  const brand =
    typeof product.brands === "string" && product.brands.trim()
      ? product.brands.split(",")[0].trim()
      : undefined;

  return {
    code,
    name: name.slice(0, 120),
    brand,
    per100g,
    servingSizeG: parseServingGrams(product.serving_size)
  };
}

/** Scale per-100g macros to an arbitrary gram amount, rounding each field. */
export function scaleMacros(per100g: Macros, grams: number): Macros {
  const factor = grams / 100;
  const scale = (value: number | undefined): number | undefined =>
    value === undefined ? undefined : Math.round(value * factor);
  return {
    calories: scale(per100g.calories),
    proteinG: scale(per100g.proteinG),
    carbsG: scale(per100g.carbsG),
    fatG: scale(per100g.fatG),
    fiberG: scale(per100g.fiberG),
    sugarG: scale(per100g.sugarG),
    sodiumMg: scale(per100g.sodiumMg)
  };
}
