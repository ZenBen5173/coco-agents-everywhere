/**
 * Sending someone to Google to grant calendar access for the team.
 *
 * One shared connection: whoever clicks Connect lends their calendar to the
 * board. `access_type=offline` with `prompt=consent` is what actually returns a
 * refresh token — without both, Google hands back an hour-long access token
 * and nothing to renew it with.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CALENDAR_SCOPES } from "agent-core";

export const dynamic = "force-dynamic";

export function redirectUri(request: Request): string {
  // Built from the request, so localhost and a deployment each send Google the
  // address they are actually reachable at. It must be listed on the OAuth client.
  return new URL("/api/google/callback", new URL(request.url).origin).toString();
}

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) return NextResponse.redirect(new URL("/?google=unconfigured", request.url));

  // Echoed back by Google and checked on return, so a crafted link cannot
  // connect somebody else's calendar to this board.
  const state = crypto.randomUUID();
  const store = await cookies();
  store.set("google_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri(request));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", CALENDAR_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return NextResponse.redirect(url.toString());
}
