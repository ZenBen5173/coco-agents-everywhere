import { NextResponse } from "next/server";
import { z } from "zod";
import { serviceClient } from "agent-core/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const changesSchema = z
  .object({
    body: z.string().trim().min(1).max(20_000).optional(),
    colour: z.string().max(20).nullable().optional(),
    pinned: z.boolean().optional(),
    /** Archived rather than deleted: notes are cheap to keep. */
    archived: z.boolean().optional(),
  })
  .strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = changesSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, { status: 400 });
  const { archived, ...rest } = parsed.data;
  const update: Record<string, unknown> = { ...rest };
  if (archived !== undefined) update.archived_at = archived ? new Date().toISOString() : null;
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  const { data, error } = await serviceClient().from("notes").update(update).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ note: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await serviceClient().from("notes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ ok: true });
}
