type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/**
 * Simple fixed-window in-memory limiter. Sufficient for a local-first,
 * few-users app to stop a runaway client from hammering the paid AI
 * endpoint. Per server instance (not distributed).
 *
 * Callers key buckets as `${route}:${userId}` (see handleAIRoute and the
 * food routes) so one member — or one leaked token — can't exhaust the
 * shared window for everyone else.
 */
export function checkRateLimit(
  key: string,
  limit = 20,
  windowMs = 60_000,
  now: number = Date.now()
): RateLimitResult {
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true };
}

/** Test helper to clear all buckets between cases. */
export function resetRateLimiter(): void {
  buckets.clear();
}
