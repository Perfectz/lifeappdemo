import { afterEach, describe, expect, it } from "vitest";

import { checkRateLimit, resetRateLimiter } from "@/server/ai/rateLimiter";

afterEach(() => {
  resetRateLimiter();
});

describe("checkRateLimit", () => {
  it("allows requests up to the limit then blocks", () => {
    const t0 = 1_000;
    for (let i = 0; i < 3; i += 1) {
      expect(checkRateLimit("k", 3, 60_000, t0).ok).toBe(true);
    }
    const blocked = checkRateLimit("k", 3, 60_000, t0);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("resets after the window elapses", () => {
    const t0 = 1_000;
    expect(checkRateLimit("w", 1, 1_000, t0).ok).toBe(true);
    expect(checkRateLimit("w", 1, 1_000, t0 + 500).ok).toBe(false);
    expect(checkRateLimit("w", 1, 1_000, t0 + 1_001).ok).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const t0 = 1_000;
    expect(checkRateLimit("a", 1, 60_000, t0).ok).toBe(true);
    expect(checkRateLimit("b", 1, 60_000, t0).ok).toBe(true);
    expect(checkRateLimit("a", 1, 60_000, t0).ok).toBe(false);
  });
});
