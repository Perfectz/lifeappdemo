/**
 * Shared Supabase project configuration for both the browser client and the
 * server-side auth guard.
 *
 * Public, RLS-protected values. Safe to ship in the browser bundle — they
 * identify the project, they don't grant data access (that's enforced by Row
 * Level Security). Env vars override these for local/other environments.
 * To rotate: change here or set the env vars in Vercel.
 */

const DEFAULT_SUPABASE_URL = "https://skhjmkrbcdhzwelldfkg.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_nMxXJky_y_fOFelAwvDe8g_mB4vfDMm";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? DEFAULT_SUPABASE_URL;
export const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? DEFAULT_SUPABASE_ANON_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}
