/**
 * Slack → Supabase plumbing for the listener: member sync and history backfill.
 * Nothing here talks to the model.
 */
import type { WebClient } from "@slack/web-api";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Member, MessageRow } from "agent-core/shared";

/** Message subtypes that still carry a person's words. Everything else (joins, pins, bot posts) is noise. */
const KEEP_SUBTYPES = new Set([undefined, "file_share", "thread_broadcast"]);

export type SlackMessageLike = {
  ts?: string;
  user?: string;
  text?: string;
  subtype?: string;
  bot_id?: string;
  thread_ts?: string;
};

export function toMessageRow(m: SlackMessageLike, channelId: string): Omit<MessageRow, "extracted_at"> | null {
  if (!m.ts || !m.user || !m.text?.trim()) return null;
  if (m.bot_id) return null;
  if (!KEEP_SUBTYPES.has(m.subtype)) return null;
  return {
    ts: m.ts,
    channel_id: channelId,
    user_id: m.user,
    text: m.text,
    thread_ts: m.thread_ts ?? null,
    posted_at: new Date(Number(m.ts) * 1000).toISOString(),
  };
}

export async function syncMembers(slack: WebClient, db: SupabaseClient): Promise<Member[]> {
  const res = await slack.users.list({ limit: 200 });
  const rows: Member[] = (res.members ?? [])
    .filter((u) => u.id && !u.deleted && u.id !== "USLACKBOT")
    .map((u) => ({
      slack_user_id: u.id!,
      display_name: u.profile?.display_name?.trim() || u.real_name?.trim() || u.name || u.id!,
      avatar_url: u.profile?.image_72 ?? null,
      is_bot: Boolean(u.is_bot),
    }));
  if (rows.length) {
    const { error } = await db.from("members").upsert(rows, { onConflict: "slack_user_id" });
    if (error) throw new Error(`members upsert failed: ${error.message}`);
  }
  return rows;
}

/** Make sure a speaker exists before their message is inserted (FK). */
export async function ensureMember(slack: WebClient, db: SupabaseClient, userId: string): Promise<void> {
  const { data } = await db.from("members").select("slack_user_id").eq("slack_user_id", userId).maybeSingle();
  if (data) return;
  const info = await slack.users.info({ user: userId }).catch(() => null);
  const u = info?.user;
  await db.from("members").upsert(
    {
      slack_user_id: userId,
      display_name: u?.profile?.display_name?.trim() || u?.real_name?.trim() || u?.name || userId,
      avatar_url: u?.profile?.image_72 ?? null,
      is_bot: Boolean(u?.is_bot),
    },
    { onConflict: "slack_user_id" },
  );
}

/** Pull anything said while the listener was down. Idempotent: `ts` is the primary key. */
export async function backfill(slack: WebClient, db: SupabaseClient, channelId: string): Promise<number> {
  const { data: latest } = await db
    .from("messages")
    .select("ts")
    .eq("channel_id", channelId)
    .order("posted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const history = await slack.conversations.history({
    channel: channelId,
    oldest: latest?.ts ?? undefined,
    inclusive: false,
    limit: 200,
  });

  const rows = (history.messages ?? [])
    .map((m) => toMessageRow(m as SlackMessageLike, channelId))
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (rows.length === 0) return 0;

  for (const userId of new Set(rows.map((r) => r.user_id!))) await ensureMember(slack, db, userId);

  const { error } = await db.from("messages").upsert(rows, { onConflict: "ts", ignoreDuplicates: true });
  if (error) throw new Error(`messages backfill failed: ${error.message}`);
  return rows.length;
}
