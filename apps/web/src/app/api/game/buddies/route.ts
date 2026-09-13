import { NextResponse } from "next/server";
import { setEquipped } from "agent-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The whole set travels at once; the server checks ownership and slots. */
export async function POST(request: Request) {
  const { member, pets } = (await request.json().catch(() => ({}))) as { member?: string; pets?: string[] };
  if (!member || !Array.isArray(pets)) return NextResponse.json({ error: "member and pets are required" }, { status: 400 });
  try {
    return NextResponse.json(await setEquipped(member, pets.map(String)));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 400 });
  }
}
