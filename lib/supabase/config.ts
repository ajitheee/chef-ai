/**
 * Supabase connection config. Reads public env vars (safe to expose — the anon
 * key is designed for the browser and is guarded by row-level security).
 *
 * The app runs fine with these blank: every data module falls back to
 * localStorage until a project is connected. See supabase/SETUP.md for the
 * 3-minute hookup.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** True once both env vars are present — the app can talk to Supabase. */
export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}
