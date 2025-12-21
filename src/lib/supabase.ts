import { createClient, SupabaseClient } from "@supabase/supabase-js";

// This utility initializes the Supabase client for use throughout the app.
// It uses environment variables for security and flexibility, and can be imported
// in both server and client contexts as needed.

// Lazy initialization to avoid build-time errors when env vars are not set
let _supabase: SupabaseClient | null = null;

/**
 * Get the Supabase client instance (lazy initialization)
 * This defers the environment variable check to runtime instead of build time
 */
export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
    }

    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
}

// Keep backwards compatibility - but use getter to defer initialization
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return Reflect.get(getSupabase(), prop);
  },
});
