/**
 * Server-side Supabase client. Uses the service-role key, which bypasses row
 * security, so this must never be imported from a client component.
 *
 * The one rule of this project — agents write captures, only approve_capture()
 * writes items — is enforced by a trigger in the database, not by which key you
 * hold. This client is allowed to call approve_capture(); it is not allowed to
 * insert into items directly, and Postgres will refuse if it tries.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | undefined;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}. Add it to the root .env.`);
  return value;
}

export function serviceClient(): SupabaseClient {
  if (!cached) {
    cached = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_KEY?.trim());
}
