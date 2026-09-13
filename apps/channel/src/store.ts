/**
 * What the Slack tools need from the database, behind a small interface so the
 * tools can be tested with an in-memory store and no Supabase project.
 *
 * Writes here are to messages, members and captures only. There is no method
 * that touches items — by design, not by omission.
 */
import { serviceClient } from "agent-core";
import type { ExtractedCapture } from "agent-core";
import type { CaptureRow, ItemRow, Member, MessageRow } from "agent-core/shared";

export type MessageInsert = Omit<MessageRow, "extracted_at">;

export interface CommitStore {
  members(): Promise<Member[]>;
  ensureMembers(rows: Member[]): Promise<void>;
  storeMessages(rows: MessageInsert[]): Promise<void>;
  /** Returns how many were new; duplicates are silently ignored. */
  insertCaptures(rows: ExtractedCapture[]): Promise<number>;
  pendingCaptures(): Promise<CaptureRow[]>;
  items(): Promise<ItemRow[]>;
}

export function supabaseStore(): CommitStore {
  const db = serviceClient();
  const fail = (what: string, error: { message: string } | null) => {
    if (error) throw new Error(`${what}: ${error.message}`);
  };
  return {
    async members() {
      const { data, error } = await db.from("members").select("*");
      fail("members", error);
      return (data ?? []) as Member[];
    },
    async ensureMembers(rows) {
      if (!rows.length) return;
      const { error } = await db.from("members").upsert(rows, { onConflict: "slack_user_id", ignoreDuplicates: true });
      fail("members upsert", error);
    },
    async storeMessages(rows) {
      if (!rows.length) return;
      const { error } = await db.from("messages").upsert(rows, { onConflict: "ts", ignoreDuplicates: true });
      fail("messages upsert", error);
    },
    async insertCaptures(rows) {
      if (!rows.length) return 0;
      const { data, error } = await db
        .from("captures")
        .upsert(rows, { onConflict: "source_ts,type,title", ignoreDuplicates: true })
        .select("id");
      fail("captures insert", error);
      return data?.length ?? 0;
    },
    async pendingCaptures() {
      const { data, error } = await db.from("captures").select("*").eq("status", "pending").order("created_at", { ascending: false });
      fail("captures", error);
      return (data ?? []) as CaptureRow[];
    },
    async items() {
      const { data, error } = await db.from("items").select("*").order("due_date", { ascending: true, nullsFirst: false });
      fail("items", error);
      return (data ?? []) as ItemRow[];
    },
  };
}

/** For tests and offline runs. */
export function memoryStore(seed: { members?: Member[]; captures?: CaptureRow[]; items?: ItemRow[] } = {}): CommitStore & {
  messages: MessageInsert[];
  captures: ExtractedCapture[];
} {
  const members = new Map((seed.members ?? []).map((m) => [m.slack_user_id, m]));
  const messages: MessageInsert[] = [];
  const captures: ExtractedCapture[] = [];
  return {
    messages,
    captures,
    async members() {
      return [...members.values()];
    },
    async ensureMembers(rows) {
      for (const r of rows) if (!members.has(r.slack_user_id)) members.set(r.slack_user_id, r);
    },
    async storeMessages(rows) {
      for (const r of rows) if (!messages.some((m) => m.ts === r.ts)) messages.push(r);
    },
    async insertCaptures(rows) {
      let n = 0;
      for (const r of rows) {
        if (captures.some((c) => c.source_ts === r.source_ts && c.type === r.type && c.title === r.title)) continue;
        captures.push(r);
        n++;
      }
      return n;
    },
    async pendingCaptures() {
      return seed.captures ?? [];
    },
    async items() {
      return seed.items ?? [];
    },
  };
}
