import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  isAppCreator,
  isSupabaseConfigured,
  supabaseAnonKey,
  supabaseUrl
} from "@/lib/supabase/config";

/**
 * Server-side auth guard for API routes.
 *
 * The app's Supabase auth (invite-only, see AuthGate/membership) was only
 * enforced client-side + RLS — the API routes themselves were open, letting
 * anyone with the deployed URL consume paid OpenAI quota. Every AI/food/
 * realtime route now requires a valid `Authorization: Bearer <access token>`
 * header, validated against Supabase Auth via `auth.getUser(jwt)`, AND the
 * caller must be an approved member (or the app creator) — matching the
 * invite-only gate the UI enforces via AuthGate/app_members RLS.
 *
 * When Supabase isn't configured at all, the app is local-only (no auth
 * system exists), so the guard degrades open with a synthetic user — matching
 * how AuthGate falls through to local-only mode. The Playwright suite runs
 * with NEXT_PUBLIC_E2E=1 (no real session in the browser), so that flag
 * bypasses the guard exactly like it bypasses AuthGate.
 */

export type AuthenticatedUser = { id: string; email: string | null };

export type RequireUserResult =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; status: 401 | 403; message: string };

const UNAUTHORIZED: RequireUserResult = {
  ok: false,
  status: 401,
  message: "Sign in to use this feature."
};

const NOT_APPROVED: RequireUserResult = {
  ok: false,
  status: 403,
  message: "Your account is awaiting approval by the app creator."
};

/**
 * Auth-only Supabase client (anon key). `auth.getUser(jwt)` verifies the
 * token against the Supabase Auth server, so a forged/expired JWT fails.
 */
let authClient: SupabaseClient | null = null;

function getAuthClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!authClient) {
    authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
  }
  return authClient;
}

/**
 * Test override, following the existing `set…ForTests` pattern.
 * - `setAuthUserForTests(user)`  → requireUser resolves that user
 * - `setAuthUserForTests(null)`  → requireUser rejects (simulates signed-out)
 * - `setAuthUserForTests(undefined)` → clears the override
 * Without an override, requireUser auto-passes under NODE_ENV=test so route
 * tests can keep calling handlers directly (mirrors realtimeClient's mock).
 */
let testOverride: { user: AuthenticatedUser | null } | undefined;

export function setAuthUserForTests(user: AuthenticatedUser | null | undefined): void {
  testOverride = user === undefined ? undefined : { user };
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

/**
 * Invite-only member check, mirroring the client's resolveMembershipStatus:
 * the creator is always approved; everyone else must have an app_members row
 * with status 'approved'. The query runs with the CALLER'S token so the
 * existing RLS policy ("members read their own row") authorizes it — no
 * service-role key needed. Fails closed on any error.
 */
async function isApprovedMember(token: string, user: AuthenticatedUser): Promise<boolean> {
  if (isAppCreator(user.email)) return true;

  try {
    // Per-request client so the caller's JWT rides along on the query.
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data, error } = await client
      .from("app_members")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) return false;
    return data?.status === "approved";
  } catch {
    return false;
  }
}

export async function requireUser(request: Request): Promise<RequireUserResult> {
  if (testOverride) {
    return testOverride.user ? { ok: true, user: testOverride.user } : UNAUTHORIZED;
  }
  if (process.env.NODE_ENV === "test") {
    return { ok: true, user: { id: "test-user", email: "test@example.com" } };
  }
  // e2e bypass: the Playwright webserver sets NEXT_PUBLIC_E2E=1 and drives the
  // app without a real session — same bypass AuthGate applies client-side.
  // Never set this in a real deployment.
  if (process.env.NEXT_PUBLIC_E2E === "1") {
    return { ok: true, user: { id: "e2e", email: null } };
  }

  const client = getAuthClient();
  if (!client) {
    // Local-only mode: Supabase absent means there is no auth system to check.
    return { ok: true, user: { id: "local", email: null } };
  }

  const token = bearerToken(request);
  if (!token) return UNAUTHORIZED;

  let user: AuthenticatedUser;
  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return UNAUTHORIZED;
    user = { id: data.user.id, email: data.user.email ?? null };
  } catch {
    // Fail closed: if the auth server is unreachable we don't hand out
    // paid-API access to unverified callers.
    return UNAUTHORIZED;
  }

  if (!(await isApprovedMember(token, user))) {
    return NOT_APPROVED;
  }

  return { ok: true, user };
}
