import type { SupabaseClient } from "@supabase/supabase-js";

/** Display name for a Slack id, for calendar descriptions. */
export async function ownerName(db: SupabaseClient, slackUserId: string | null): Promise<string | undefined> {
  if (!slackUserId) return undefined;
  const { data } = await db.from("members").select("display_name").eq("slack_user_id", slackUserId).maybeSingle();
  return data?.display_name ?? undefined;
}
