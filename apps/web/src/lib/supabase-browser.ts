import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Read-only-by-convention browser client on the anon key.
 *
 * The pages read the queue and the board straight from Supabase and subscribe
 * to Realtime for live updates. Every write goes through a route handler with
 * the service key, and the one write that matters — creating an item — is
 * guarded by a database trigger, not by which key you hold.
 */
let cached: SupabaseClient | null | undefined;

export function browserClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  cached = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return cached;
}
