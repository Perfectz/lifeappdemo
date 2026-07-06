import { NextResponse } from "next/server";

import { getFoodByBarcode } from "@/server/food/openFoodFacts";
import { checkRateLimit } from "@/server/ai/rateLimiter";
import { requireUser } from "@/server/auth/requireUser";

export const maxDuration = 30;

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const limit = checkRateLimit(`food-barcode:${auth.user.id}`);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many lookups. Please slow down for a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const code = new URL(request.url).searchParams.get("code")?.trim() ?? "";
  if (!/^\d{6,14}$/.test(code)) {
    return NextResponse.json({ error: "That doesn't look like a valid barcode." }, { status: 400 });
  }

  try {
    const item = await getFoodByBarcode(code);
    if (!item) {
      return NextResponse.json({ error: "No product found for that barcode." }, { status: 404 });
    }
    return NextResponse.json({ item });
  } catch (error) {
    // Log the detail server-side; don't echo internal fetch/undici error text
    // (hostnames, DNS failures) to the browser.
    console.error("food barcode lookup failed:", error);
    return NextResponse.json(
      { error: "The food database is unavailable right now. Try again or add the food manually." },
      { status: 502 }
    );
  }
}
