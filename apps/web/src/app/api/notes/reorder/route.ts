/** Persist the board order after a drag. The client sends the whole visible order. */
import { NextResponse } from "next/server";
import { z } from "zod";
import { serviceClient } from "agent-core/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = z.object({ order: z.array(z.string()).max(500) }).safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Bad order." }, { status: 400 });
  const db = serviceClient();
  const writes = parsed.data.order.map((id, position) => db.from("notes").update({ position }).eq("id", id));
  const results = await Promise.all(writes);
  const failed = results.find((r) => r.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 409 });
  return NextResponse.json({ ok: true });
}
