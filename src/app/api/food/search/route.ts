import { NextResponse } from "next/server";

import { searchFoods } from "@/server/food/openFoodFacts";
import { checkRateLimit } from "@/server/ai/rateLimiter";

export const maxDuration = 30;

export async function GET(request: Request) {
  const limit = checkRateLimit("food-search");
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many searches. Please slow down for a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ error: "Type at least two characters to search." }, { status: 400 });
  }

  try {
    const items = await searchFoods(query.slice(0, 100));
    return NextResponse.json({ items });
  } catch (error) {
    // Log the detail server-side; don't echo internal fetch/undici error text
    // (hostnames, DNS failures) to the browser.
    console.error("food search failed:", error);
    return NextResponse.json(
      { error: "The food database is unavailable right now. Try again or add the food manually." },
      { status: 502 }
    );
  }
}
