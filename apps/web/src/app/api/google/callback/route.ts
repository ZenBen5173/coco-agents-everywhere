/** Google sending the person back with a code to exchange for the team's refresh token. */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { serviceClient } from "agent-core/supabase";
import { redirectUri } from "@/app/api/google/start/route";

export const dynamic = "force-dynamic";

const back = (request: Request, result: string) => NextResponse.redirect(new URL(`/?google=${result}`, request.url));

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (url.searchParams.get("error")) return back(request, "cancelled");
  if (!code) return back(request, "failed");

  const store = await cookies();
  const expected = store.get("google_oauth_state")?.value;
  store.delete("google_oauth_state");
  if (!expected || !state || expected !== state) return back(request, "state");

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return back(request, "unconfigured");

  const exchange = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri(request), grant_type: "authorization_code" }),
  });
  const token = (await exchange.json().catch(() => null)) as { refresh_token?: string; access_token?: string; expires_in?: number } | null;
  // No refresh token usually means Google saw an earlier grant and issued
  // nothing new; prompt=consent on the way out is what prevents it.
  if (!exchange.ok || !token?.refresh_token) return back(request, "norefresh");

  const { error } = await serviceClient().from("integrations").upsert(
    {
      service: "google",
      refresh_token: token.refresh_token,
      token: token.access_token ?? null,
      expires_at: new Date(Date.now() + (token.expires_in ?? 3600) * 1000).toISOString(),
      calendar_id: "primary",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "service" },
  );
  return back(request, error ? "failed" : "connected");
}
