import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { ThreadMessage } from "@copilotkit/channels";
import type { CaptureRow, ItemRow } from "agent-core/shared";
import { createBoardTool, createCaptureTool, readThread, toMessageInserts } from "./tools";
import { memoryStore } from "./store";

/** Only the methods these tools call; the rest of Thread is irrelevant here. */
const stubContext = (thread: Record<string, unknown>) =>
  ({
    thread,
    user: { id: "u1", name: "priya" },
    actor: { id: "a1" },
    platform: "slack",
  }) as never;

const human = (id: string, name: string, ts: string, text: string): ThreadMessage => ({
  text,
  ts,
  providerMessage: {
    logicalMessageId: ts,
    revisionId: "r1",
    occurredAt: new Date(Number(ts) * 1000).toISOString(),
    deleted: false,
    currentTrigger: false,
    actor: { id, kind: "human", displayName: name, handle: null },
    files: [],
  },
});

describe("read_thread", () => {
  it("returns the messages when the surface exposes history", async () => {
    const messages = [{ text: "checkout is timing out" }];
    const result = await readThread.handler({}, stubContext({ getMessages: mock.fn(async () => messages) }));
    assert.deepEqual(result, messages);
  });

  it("degrades into an instruction, not an empty array, when history is unavailable", async () => {
    // getMessages() is capability-gated: it returns [] rather than throwing on
    // surfaces that cannot read history. Handing that [] straight to the model
    // reads as "the thread is empty".
    const result = await readThread.handler({}, stubContext({ getMessages: mock.fn(async () => []) }));
    assert.equal(typeof result, "string");
    assert.match(String(result), /cannot see earlier messages/i);
  });
});

describe("toMessageInserts", () => {
  it("keeps human text, drops bots and empty lines, and collects speakers", () => {
    const { rows, speakers } = toMessageInserts(
      [
        human("U1", "Amy", "1700000000.000100", "I'll send the deck tonight"),
        { text: "hello from a bot", ts: "1700000000.000200", isBot: true },
        human("U1", "Amy", "1700000000.000300", "   "),
        human("U2", "Ben", "1700000000.000400", "let's use Supabase"),
      ],
      "C1",
    );
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((r) => r.user_id), ["U1", "U2"]);
    assert.deepEqual(speakers.map((s) => s.display_name), ["Amy", "Ben"]);
    assert.equal(rows[0]?.channel_id, "C1");
  });
});

describe("capture_from_thread", () => {
  it("stores messages, runs the extractor, inserts captures, posts a card, and never touches items", async () => {
    const store = memoryStore();
    const posted: unknown[] = [];
    const extract = mock.fn(async () => [
      {
        type: "commitment" as const,
        title: "Send the deck",
        owner_slack_id: "U1",
        due_date: null,
        all_day: true,
        source_text: "I'll send the deck tonight",
        source_ts: "1700000000.000100",
        confidence: 0.9,
        reasoning: "explicit",
      },
    ]);
    const tool = createCaptureTool({ store, extract, reviewUrl: "http://x/review", channelId: "C1" });
    const result = await tool.handler(
      {},
      stubContext({
        getMessages: mock.fn(async () => [human("U1", "Amy", "1700000000.000100", "I'll send the deck tonight")]),
        post: mock.fn(async (ui: unknown) => {
          posted.push(ui);
          return { id: "m1" };
        }),
      }),
    );
    assert.equal(store.messages.length, 1);
    assert.equal(store.captures.length, 1);
    assert.equal(extract.mock.callCount(), 1);
    assert.equal(posted.length, 1);
    assert.match(String(result), /Sent 1 new capture/);
    assert.match(String(result), /Nothing is on the board/);
    assert.ok(!("items" in store && typeof (store as { items: unknown }).items === "object"), "the store exposes no item writes");
  });

  it("ignores duplicates on a second read of the same thread", async () => {
    const store = memoryStore();
    const capture = {
      type: "decision" as const,
      title: "Use Supabase",
      owner_slack_id: null,
      due_date: null,
      all_day: true,
      source_text: "let's use Supabase",
      source_ts: "1700000000.000400",
      confidence: 0.95,
      reasoning: "settled",
    };
    const tool = createCaptureTool({ store, extract: async () => [capture], reviewUrl: "http://x/review", channelId: "C1" });
    const ctx = stubContext({
      getMessages: mock.fn(async () => [human("U2", "Ben", "1700000000.000400", "let's use Supabase")]),
      post: mock.fn(async () => ({ id: "m" })),
    });
    await tool.handler({}, ctx);
    const second = await tool.handler({}, ctx);
    assert.equal(store.captures.length, 1);
    assert.match(String(second), /Sent 0 new capture/);
  });

  it("says so when the thread has nothing readable", async () => {
    const tool = createCaptureTool({ store: memoryStore(), extract: async () => [], channelId: "C1" });
    const result = await tool.handler({}, stubContext({ getMessages: mock.fn(async () => []), post: mock.fn() }));
    assert.match(String(result), /nothing to capture/i);
  });
});

describe("list_board", () => {
  const members = [
    { slack_user_id: "U1", display_name: "Amy", avatar_url: null, is_bot: false },
    { slack_user_id: "U2", display_name: "Ben", avatar_url: null, is_bot: false },
  ];
  const pending: CaptureRow[] = [
    {
      id: "c1",
      type: "commitment",
      title: "Record the demo",
      owner_slack_id: "U2",
      due_date: null,
      all_day: true,
      source_text: "I'll record it",
      source_ts: "1",
      confidence: 0.8,
      reasoning: null,
      status: "pending",
      reviewed_at: null,
      tag: null,
      created_at: new Date().toISOString(),
    },
  ];
  const items: ItemRow[] = [
    {
      id: "i1",
      capture_id: "c0",
      type: "deadline",
      title: "Submission closes",
      owner_slack_id: null,
      due_date: "2000-01-01T00:00:00.000Z",
      all_day: true,
      source_text: "closes Sunday",
      source_ts: "0",
      status: "open",
      human_confirmed: true,
      created_at: "",
      updated_at: "",
      completed_at: null,
      calendar_event_id: null,
      tag: null,
    },
    {
      id: "i2",
      capture_id: "c2",
      type: "commitment",
      title: "Write the README",
      owner_slack_id: "U1",
      due_date: null,
      all_day: true,
      source_text: "on it",
      source_ts: "2",
      status: "done",
      human_confirmed: false,
      created_at: "",
      updated_at: "",
      completed_at: null,
      calendar_event_id: null,
      tag: null,
    },
  ];

  it("labels overdue open items as late and resolves owners to names", async () => {
    const tool = createBoardTool(memoryStore({ members, captures: pending, items }));
    const all = (await tool.handler({ scope: "all" }, stubContext({}))) as { rows: { title: string; status: string; owner: string }[] };
    assert.deepEqual(
      all.rows.map((r) => [r.title, r.status, r.owner]),
      [
        ["Record the demo", "pending", "Ben"],
        ["Submission closes", "late", "Nobody yet"],
        ["Write the README", "done", "Amy"],
      ],
    );
  });

  it("filters by scope and owner", async () => {
    const tool = createBoardTool(memoryStore({ members, captures: pending, items }));
    const late = (await tool.handler({ scope: "late" }, stubContext({}))) as { rows: { title: string }[] };
    assert.deepEqual(late.rows.map((r) => r.title), ["Submission closes"]);
    const amy = (await tool.handler({ scope: "all", owner: "amy" }, stubContext({}))) as { rows: { title: string }[] };
    assert.deepEqual(amy.rows.map((r) => r.title), ["Write the README"]);
    const none = await tool.handler({ scope: "pending", owner: "zed" }, stubContext({}));
    assert.match(String(none), /Nothing matches/);
  });
});
