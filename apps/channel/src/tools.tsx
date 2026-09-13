/**
 * COCO's Slack tools.
 *
 * A channel tool handler receives the LIVE thread, so capture_from_thread can
 * read the conversation, run the extractor, and post a card — all without the
 * agent ever touching the board. Nothing in this file writes to items.
 *
 * The return value is what the *agent* reads back, not what the user sees.
 */
import { defineChannelTool } from "@copilotkit/channels";
import type { ThreadMessage } from "@copilotkit/channels";
import { z } from "zod";
import { extractCaptures, resolveTimeZone } from "agent-core";
import type { ExtractInput, ExtractedCapture } from "agent-core";
import { daysUntil, formatDue, type Member } from "agent-core/shared";
import { capturedCard } from "./components";
import { supabaseStore, type CommitStore, type MessageInsert } from "./store";
export { searchTheWeb } from "./search";

/** Read what the thread already says. */
export const readThread = defineChannelTool({
  name: "read_thread",
  description:
    "Read the recent messages in this conversation. Call this before answering anything about what was said, promised or decided here.",
  parameters: z.object({}),
  async handler(_args, { thread }) {
    const messages = await thread.getMessages();
    if (messages.length === 0) {
      return "This surface does not expose conversation history, or the thread is empty. Say that you cannot see earlier messages and ask for the shortest possible summary.";
    }
    return messages;
  },
});

/** Slack thread messages → rows the extractor and the database understand. */
export function toMessageInserts(messages: ThreadMessage[], channelId: string): { rows: MessageInsert[]; speakers: Member[] } {
  const rows: MessageInsert[] = [];
  const speakers = new Map<string, Member>();
  for (const m of messages) {
    if (m.isBot || !m.text?.trim()) continue;
    const actor = m.providerMessage?.actor;
    const userId = actor?.id ?? m.user?.id;
    const ts = m.ts ?? m.providerMessage?.logicalMessageId;
    if (!userId || !ts) continue;
    if (actor && actor.kind !== "human") continue;
    const postedAt = m.providerMessage?.occurredAt ?? new Date(Number(ts) * 1000).toISOString();
    rows.push({ ts, channel_id: channelId, user_id: userId, text: m.text, thread_ts: null, posted_at: postedAt });
    if (!speakers.has(userId)) {
      speakers.set(userId, {
        slack_user_id: userId,
        display_name: actor?.displayName ?? actor?.handle ?? m.user?.name ?? userId,
        avatar_url: null,
        is_bot: false,
      });
    }
  }
  return { rows, speakers: [...speakers.values()] };
}

export type CaptureToolDeps = {
  store?: CommitStore;
  extract?: (input: ExtractInput) => Promise<ExtractedCapture[]>;
  reviewUrl?: string;
  channelId?: string;
};

/**
 * Send what this thread says to the review queue. Posts a card and returns;
 * the human decides on the web page. Dependencies are injectable for tests.
 */
export function createCaptureTool(deps: CaptureToolDeps = {}) {
  const reviewUrl = deps.reviewUrl ?? `${process.env.WEB_URL ?? "http://127.0.0.1:3100"}/review`;
  return defineChannelTool({
    name: "capture_from_thread",
    description:
      "Read this thread and send every commitment, decision and deadline in it to the review queue as pending captures. Call when someone asks you to 'note that', 'track this', 'add these to the board', or to catch up on what was promised. Nothing reaches the board — a human approves on the review page.",
    parameters: z.object({}),
    async handler(_args, { thread }) {
      const messages = await thread.getMessages();
      const channelId = deps.channelId ?? process.env.SLACK_CHANNEL_ID ?? "slack";
      const { rows, speakers } = toMessageInserts(messages, channelId);
      if (rows.length === 0) {
        return "No readable human messages in this thread, so there is nothing to capture. Say so.";
      }
      const store = deps.store ?? supabaseStore();
      await store.ensureMembers(speakers);
      await store.storeMessages(rows);
      const members = await store.members();
      const extract = deps.extract ?? extractCaptures;
      const captures = await extract({
        messages: rows.map((r) => ({ ts: r.ts, user_id: r.user_id, text: r.text, posted_at: r.posted_at })),
        members,
        timeZone: resolveTimeZone(),
      });
      const inserted = await store.insertCaptures(captures);
      await thread.post(capturedCard(inserted, captures.map((c) => c.title), reviewUrl));
      if (captures.length === 0) return "Read the thread; nothing in it was a commitment, decision or deadline. Nothing was sent to review.";
      return `Sent ${inserted} new capture(s) to the review queue (${captures.length - inserted} were already there): ${captures
        .map((c) => `${c.type} "${c.title}"`)
        .join("; ")}. They are pending. Nothing is on the board until a human approves.`;
    },
  });
}

export const captureFromThread = createCaptureTool();

/** Read the queue and the board. */
export function createBoardTool(store?: CommitStore) {
  return defineChannelTool({
    name: "list_board",
    description:
      "Read the review queue (pending) and the board (open / late / done). Use before answering what is pending, late, done, or owned by someone. Returns rows with display names and formatted dates; draw them with item_list.",
    parameters: z.object({
      scope: z.enum(["pending", "open", "late", "done", "all"]).default("all"),
      owner: z.string().optional().describe("Filter by a person's display name (case-insensitive contains)."),
    }),
    async handler({ scope, owner }) {
      const db = store ?? supabaseStore();
      const timeZone = resolveTimeZone();
      const now = new Date();
      const members = await db.members();
      const name = (id: string | null) => members.find((m) => m.slack_user_id === id)?.display_name ?? "Nobody yet";
      const matches = (id: string | null) => !owner || name(id).toLowerCase().includes(owner.toLowerCase());

      const out: { title: string; owner: string; due: string; status: string; type: string }[] = [];
      if (scope === "pending" || scope === "all") {
        for (const c of await db.pendingCaptures()) {
          if (!matches(c.owner_slack_id)) continue;
          out.push({ title: c.title, owner: name(c.owner_slack_id), due: formatDue(c.due_date, c.all_day, timeZone), status: "pending", type: c.type });
        }
      }
      if (scope !== "pending") {
        for (const i of await db.items()) {
          if (!matches(i.owner_slack_id)) continue;
          const late = i.status === "open" && !!i.due_date && daysUntil(i.due_date, now, timeZone) < 0;
          const status = late ? "late" : i.status;
          if (scope === "open" && i.status !== "open") continue;
          if (scope === "late" && !late) continue;
          if (scope === "done" && i.status !== "done") continue;
          if (scope === "all" && i.status === "dropped") continue;
          out.push({ title: i.title, owner: name(i.owner_slack_id), due: formatDue(i.due_date, i.all_day, timeZone), status, type: i.type });
        }
      }
      if (out.length === 0) return `Nothing matches (scope=${scope}${owner ? `, owner~${owner}` : ""}).`;
      return { count: out.length, rows: out };
    },
  });
}

export const listBoard = createBoardTool();
