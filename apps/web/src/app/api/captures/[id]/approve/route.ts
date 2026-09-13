/**
 * The one door onto the board.
 *
 * Calls approve_capture() in Postgres, which atomically marks the capture
 * approved and inserts the item. Any override from Edit-then-add marks the item
 * human_confirmed. A trigger refuses items for anything not approved, so even a
 * bug elsewhere cannot write to the board.
 *
 * If a calendar is connected and the item has a due date, it also gets an
 * event. Best-effort: the board never waits on Google.
 */
import { NextResponse } from "next/server";
import { serviceClient } from "agent-core/supabase";
import { resolveTimeZone, syncItem } from "agent-core";
import type { ItemRow } from "agent-core/shared";
import { itemEditSchema } from "@/lib/edits";
import { ownerName } from "@/lib/server/owner-name";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { overrides?: unknown };
  const parsed = itemEditSchema.safeParse(body.overrides ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }
  const { status: _ignored, ...overrides } = parsed.data;

  const db = serviceClient();
  const { data, error } = await db.rpc("approve_capture", { p_capture_id: id, p_overrides: overrides });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });

  let item = data as ItemRow;
  const eventId = await syncItem(item, resolveTimeZone(), await ownerName(db, item.owner_slack_id));
  if (eventId !== undefined) {
    const { data: updated } = await db.from("items").update({ calendar_event_id: eventId }).eq("id", item.id).select("*").single();
    if (updated) item = updated as ItemRow;
  }
  return NextResponse.json({ item });
}
