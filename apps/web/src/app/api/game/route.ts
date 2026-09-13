import { NextResponse } from "next/server";
import { gameSummary } from "agent-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The member's game summary. Computed server-side so a number is always something you can recompute. */
export async function GET(request: Request) {
  const member = new URL(request.url).searchParams.get("member")?.trim();
  if (!member) return NextResponse.json({ error: "member is required" }, { status: 400 });
  try {
    return NextResponse.json(await gameSummary(member));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "game failed" }, { status: 500 });
  }
}
