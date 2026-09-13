import { NextResponse } from "next/server";
import { gameSummary } from "agent-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A clear day marks itself inside the summary; this just runs it and reports. */
export async function POST(request: Request) {
  const { member } = (await request.json().catch(() => ({}))) as { member?: string };
  if (!member) return NextResponse.json({ error: "member is required" }, { status: 400 });
  const s = await gameSummary(member);
  if (s.overdue || s.due_today) {
    const n = s.overdue + s.due_today;
    return NextResponse.json({ ok: false, message: `Not clear yet — ${n} thing${n === 1 ? "" : "s"} still due.` });
  }
  return NextResponse.json({ ok: true, message: `Checked in — nothing due. Streak at ${s.streak} day${s.streak === 1 ? "" : "s"}.` });
}
