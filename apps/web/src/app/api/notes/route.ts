/**
 * Notes are stored verbatim. No model call on the way in — a note has nothing
 * to extract, and running it through a model costs money and risks a reword.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { serviceClient } from "agent-core/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  body: z.string().trim().min(1).max(20_000),
  colour: z.string().max(20).nullable().optional(),
  pinned: z.boolean().optional(),
  author_slack_id: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Type something first." }, { status: 400 });
  const db = serviceClient();
  // New notes take a lower position than anything present: what you just wrote is what you see first.
  const { data: first } = await db.from("notes").select("position").order("position", { ascending: true }).limit(1).maybeSingle();
  const position = (first?.position ?? 0) - 1;
  const { data, error } = await db
    .from("notes")
    .insert({ ...parsed.data, position })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ note: data });
}
