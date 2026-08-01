"use client";

import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/**
 * Resolve the Supabase session created by an email link (magic link or
 * password recovery).
 *
 * The client runs with `detectSessionInUrl: true`, which parses the URL
 * fragment *asynchronously* after the page mounts. Calling `getSession()`
 * once on mount therefore races that parse and often returns `null` for a
 * perfectly valid link. This waits for whichever comes first: an already
 * established session, the `SIGNED_IN` / `PASSWORD_RECOVERY` event, or the
 * timeout.
 */
export async function waitForSupabaseSession(
  timeoutMs = 10_000
): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session) return data.session;

  return new Promise<Session | null>((resolve) => {
    let settled = false;

    const finish = (session: Session | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      subscription.unsubscribe();
      resolve(session);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish(session);
    });

    const timer = setTimeout(() => finish(null), timeoutMs);
  });
}
