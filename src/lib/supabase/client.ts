import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";

/**
 * Browser Supabase client for optional cloud backup/sync.
 *
 * Only the public URL + anon key are needed (both safe to ship to the
 * browser); per-user access is enforced server-side by Row Level Security.
 * The service_role key is NOT used here.
 *
 * Returns null when the env vars are absent, so the whole app degrades
 * gracefully to local-only — exactly like the AI coach without a key.
 */

let cached: SupabaseClient | null = null;

export { isSupabaseConfigured };

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!cached) {
    cached = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Pick up the magic-link session from the URL hash on return.
        detectSessionInUrl: true
      }
    });
  }
  return cached;
}
