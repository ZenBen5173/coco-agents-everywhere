/** Whether a calendar is connected, for the sidebar. Never returns a token. */
import { NextResponse } from "next/server";
import { calendarConnection, isCalendarClientConfigured } from "agent-core";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = isCalendarClientConfigured();
  const conn = configured ? await calendarConnection().catch(() => null) : null;
  return NextResponse.json({
    configured,
    connected: conn !== null,
    calendarId: conn?.calendar_id ?? null,
    source: conn?.source ?? null,
  });
}
