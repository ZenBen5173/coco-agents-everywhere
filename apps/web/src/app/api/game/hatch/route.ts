import { NextResponse } from "next/server";
import { openEgg } from "agent-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cost, level gate and the roll are all decided here — the button is only a request. */
export async function POST(request: Request) {
  const { member, egg } = (await request.json().catch(() => ({}))) as { member?: string; egg?: string };
  if (!member || !egg) return NextResponse.json({ error: "member and egg are required" }, { status: 400 });
  try {
    return NextResponse.json(await openEgg(member, egg));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "hatch failed" }, { status: 400 });
  }
}
