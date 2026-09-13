/** Forget the team's Google grant. Does not revoke it at Google's end. */
import { NextResponse } from "next/server";
import { serviceClient } from "agent-core/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await serviceClient().from("integrations").delete().eq("service", "google");
  return NextResponse.redirect(new URL("/?google=disconnected", request.url));
}
