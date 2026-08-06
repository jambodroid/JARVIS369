import { createClient } from "@supabase/supabase-js";

// Server-only. Uses the service role key, which bypasses RLS — this must
// never be imported from a "use client" component.
export function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

// Supabase's gateway occasionally issues a request-scoped token with a
// clock-skewed "iat", producing a transient "JWT issued at future" error
// that clears itself within a second or two. Retry once rather than
// surfacing that as a broken page.
export async function withTransientRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (!message.includes("JWT issued at future")) throw err;
    await new Promise((resolve) => setTimeout(resolve, 500));
    return fn();
  }
}
