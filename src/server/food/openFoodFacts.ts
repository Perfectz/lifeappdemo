import { normalizeOpenFoodFactsProduct, type FoodSearchItem } from "@/domain/foodSearch";

/**
 * Thin Open Food Facts client. Free, no API key. Proxied through our own routes
 * to avoid CORS and to set the courtesy User-Agent OFF asks for. Network calls
 * are injectable for tests.
 *
 * Search uses the modern "Search-a-licious" service (search.openfoodfacts.org),
 * because the legacy cgi/search.pl + v2 search endpoints are frequently 503.
 * Barcode lookups use the reliable v2 product endpoint.
 */

const PRODUCT_FIELDS = "code,product_name,generic_name,brands,serving_size,nutriments";
const USER_AGENT = "LifeQuestOS/1.0 (personal health app)";
const TIMEOUT_MS = 10_000;

export type FoodFetcher = (url: string) => Promise<unknown>;

let testFetcher: FoodFetcher | undefined;

export function setFoodFetcherForTests(fetcher: FoodFetcher | undefined) {
  testFetcher = fetcher;
}

async function fetchJsonOnce(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" }
    });
    if (!response.ok) {
      throw new Error(`Food database request failed (HTTP ${response.status}).`);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Food database request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/** Fetch JSON with one retry on a transient failure (5xx / timeout). */
async function fetchJson(url: string): Promise<unknown> {
  if (testFetcher) {
    return testFetcher(url);
  }
  try {
    return await fetchJsonOnce(url);
  } catch {
    return fetchJsonOnce(url);
  }
}

function asProductArray(payload: unknown): unknown[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as { hits?: unknown; products?: unknown };
  if (Array.isArray(record.hits)) return record.hits; // Search-a-licious
  if (Array.isArray(record.products)) return record.products; // legacy / test shape
  return [];
}

export async function searchFoods(query: string, limit = 20): Promise<FoodSearchItem[]> {
  const url =
    "https://search.openfoodfacts.org/search?" +
    `q=${encodeURIComponent(query)}&page_size=${limit}&fields=${PRODUCT_FIELDS}`;
  const payload = await fetchJson(url);
  return asProductArray(payload)
    .map(normalizeOpenFoodFactsProduct)
    .filter((item): item is FoodSearchItem => item !== null)
    .slice(0, limit);
}

export async function getFoodByBarcode(code: string): Promise<FoodSearchItem | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${PRODUCT_FIELDS}`;
  const payload = await fetchJson(url);
  if (!payload || typeof payload !== "object") return null;
  const record = payload as { status?: unknown; product?: unknown };
  if (record.status === 0 || !record.product) return null;
  return normalizeOpenFoodFactsProduct(record.product);
}
