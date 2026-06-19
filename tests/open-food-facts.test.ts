import { afterEach, describe, expect, it } from "vitest";

import {
  getFoodByBarcode,
  searchFoods,
  setFoodFetcherForTests
} from "@/server/food/openFoodFacts";

afterEach(() => setFoodFetcherForTests(undefined));

describe("open food facts client", () => {
  it("normalizes search results and filters unusable ones", async () => {
    setFoodFetcherForTests(async () => ({
      products: [
        {
          code: "1",
          product_name: "Oatmeal",
          nutriments: { "energy-kcal_100g": 380, proteins_100g: 13 }
        },
        { code: "2", product_name: "", nutriments: {} } // dropped: no name
      ]
    }));
    const items = await searchFoods("oatmeal");
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Oatmeal");
  });

  it("returns a single product for a barcode", async () => {
    setFoodFetcherForTests(async () => ({
      status: 1,
      product: { code: "555", product_name: "Protein Bar", nutriments: { "energy-kcal_100g": 350 } }
    }));
    const item = await getFoodByBarcode("555");
    expect(item?.name).toBe("Protein Bar");
  });

  it("returns null when a barcode has no product", async () => {
    setFoodFetcherForTests(async () => ({ status: 0 }));
    expect(await getFoodByBarcode("000")).toBeNull();
  });
});
