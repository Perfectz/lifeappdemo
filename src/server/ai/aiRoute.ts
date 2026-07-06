import { NextResponse } from "next/server";

import { AINotConfiguredError, OpenAIRequestError } from "@/server/ai/openaiClient";
import { checkRateLimit } from "@/server/ai/rateLimiter";
import { requireUser, type AuthenticatedUser } from "@/server/auth/requireUser";

/**
 * Shared pipeline for the paid AI routes: auth → per-user rate limit → JSON
 * body parse → route logic → OpenAI error mapping.
 *
 * Every AI route used to hand-copy this ~30-line prologue/epilogue, and the
 * copies drifted (that drift already caused two bugs). Route files now only
 * contain their own validation + AI call; the boilerplate lives here once.
 */
export type AIRouteConfig = {
  /** Rate-limit bucket for this route; combined with the user id. */
  rateLimitKey: string;
  /** 429 message when the caller is rate limited. */
  rateLimitedError: string;
  /** 503 message when no OpenAI key is configured. */
  notConfiguredError: string;
  /** 502 message for unexpected failures (never echoes internals). */
  unavailableError: string;
};

export async function handleAIRoute(
  request: Request,
  config: AIRouteConfig,
  handler: (body: unknown, user: AuthenticatedUser) => Promise<Response>
): Promise<Response> {
  const auth = await requireUser(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  // Keyed per route AND per user so one member (or one leaked token) can't
  // exhaust the shared window for everyone else.
  const limit = checkRateLimit(`${config.rateLimitKey}:${auth.user.id}`);
  if (!limit.ok) {
    return NextResponse.json(
      { error: config.rateLimitedError },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  try {
    return await handler(body, auth.user);
  } catch (error) {
    if (error instanceof AINotConfiguredError) {
      return NextResponse.json({ error: config.notConfiguredError }, { status: 503 });
    }
    if (error instanceof OpenAIRequestError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status === 429 ? 429 : 502 }
      );
    }
    return NextResponse.json({ error: config.unavailableError }, { status: 502 });
  }
}
