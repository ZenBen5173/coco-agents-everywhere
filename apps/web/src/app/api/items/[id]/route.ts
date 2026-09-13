/**
 * A human correcting an item — from the sheet, the table, a drag, or a line
 * typed to the chat panel. Every path lands here and every path sets
 * human_confirmed, which is what stops a later Slack read from undoing it.
 *
 * The calendar follows: a new date moves the event, done ticks it off, dropped
 * removes it. Best-effort; a Google failure is logged, never surfaced as a
 * failed edit.
 */
import { NextResponse } from "next/server";
import { serviceClient } from "agent-core/supabase";
import { awardForItem, resolveTimeZone, syncItem } from "agent-core";
import type { ItemRow } from "agent-core/shared";
import { itemEditSchema } from "@/lib/edits";
import { ownerName } from "@/lib/server/owner-name";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raw = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  // Who is ticking: the game's player when the item has no owner.
  const actor = typeof raw.actor === "string" ? raw.actor : null;
  delete raw.actor;
  const parsed = itemEditSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const db = serviceClient();
  const { data: before } = await db.from("items").select("status").eq("id", id).maybeSingle();
  const { data, error } = await db
    .from("items")
    .update({ ...parsed.data, human_confirmed: true })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });

  let item = data as ItemRow;
  // A promise kept pays out once, the moment it is first ticked.
  if (item.status === "done" && before?.status !== "done") await awardForItem(item, actor);
  const eventId = await syncItem(item, resolveTimeZone(), await ownerName(db, item.owner_slack_id));
  if (eventId !== undefined) {
    const { data: updated } = await db.from("items").update({ calendar_event_id: eventId }).eq("id", item.id).select("*").single();
    if (updated) item = updated as ItemRow;
  }
  return NextResponse.json({ item });
}
