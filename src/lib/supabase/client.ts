import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

// Public, RLS-protected values. Safe to ship in the browser bundle — they
// identify the project, they don't grant data access (that's enforced by Row
// Level Security). Env vars override these for local/other environments.
// To rotate: change here or set the env vars in Vercel.
const DEFAULT_SUPABASE_URL = "https://skhjmkrbcdhzwelldfkg.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_nMxXJky_y_fOFelAwvDe8g_mB4vfDMm";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? DEFAULT_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? DEFAULT_SUPABASE_ANON_KEY;

let cached: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!url || !anonKey) {
    return null;
  }
  if (!cached) {
    cached = createClient(url, anonKey, {
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
