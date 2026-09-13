import { NextResponse } from "next/server";
import { claimQuests } from "agent-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { member } = (await request.json().catch(() => ({}))) as { member?: string };
  if (!member) return NextResponse.json({ error: "member is required" }, { status: 400 });
  return NextResponse.json(await claimQuests(member));
}
