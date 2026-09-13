import { NextResponse } from "next/server";
import { serviceClient } from "agent-core/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bin a pending capture. It stays in the table for the record; it never becomes an item. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await serviceClient().rpc("bin_capture", { p_capture_id: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ capture: data });
}
