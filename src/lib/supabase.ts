import { createClient } from "@supabase/supabase-js";

// This utility initializes the Supabase client for use throughout the app.
// It uses environment variables for security and flexibility, and can be imported
// in both server and client contexts as needed.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// The client is created once per import, which is safe for most Next.js usage patterns.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
