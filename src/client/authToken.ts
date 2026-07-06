import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Auth headers for calls to our own API routes.
 *
 * The server (src/server/auth/requireUser.ts) now requires a valid
 * `Authorization: Bearer <supabase access token>` on every AI/food/realtime
 * route. `getSession()` reads the cached session (refreshing it if expired)
 * without a network round-trip per call.
 *
 * Returns {} when Supabase isn't configured or nobody is signed in — the
 * request still goes out and the server decides (local-only servers allow it;
 * deployed servers answer 401, which the callers already surface as a normal
 * error path).
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return {};
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}
