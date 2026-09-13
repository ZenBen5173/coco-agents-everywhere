/**
 * Component tests.
 *
 * `renderToIR` lowers a Channels JSX tree to the platform-neutral IR the
 * adapter is actually handed, so these run with no Slack app, no Intelligence
 * project and no credentials of any kind.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToIR } from "@copilotkit/channels";
import { ACCENT, ItemList, capturedCard, welcomeMessage } from "./components";

const ctx = { platform: "slack" as const, signal: new AbortController().signal };

async function render(node: unknown): Promise<string> {
  return JSON.stringify(renderToIR((await node) as never));
}

describe("item_list", () => {
  it("renders one row per item with owner, date and status in words", async () => {
    const out = await render(
      ItemList.render(
        {
          title: "Late",
          rows: [
            { title: "Send the deck", owner: "Amy", due: "Fri 18 Sep", status: "late" },
            { title: "Book the room", owner: "Nobody yet", due: "No date", status: "open" },
          ],
        },
        ctx,
      ),
    );
    assert.ok(out.includes("Send the deck"));
    assert.ok(out.includes("Amy"));
    assert.ok(out.includes("Fri 18 Sep"));
    assert.ok(out.includes("Nobody yet"));
    assert.ok(out.includes("late"));
    assert.ok(out.includes(ACCENT));
  });

  it("adds the footer only when given", async () => {
    const rows = [{ title: "x", owner: "y", due: "z", status: "open" }];
    const without = await render(ItemList.render({ title: "T", rows }, ctx));
    const withFooter = await render(ItemList.render({ title: "T", rows, footer: "1 open" }, ctx));
    assert.ok(!without.includes("1 open"));
    assert.ok(withFooter.includes("1 open"));
  });
});

describe("capturedCard", () => {
  it("says nothing reached the board, and links to review only when there is something to review", async () => {
    const none = await render(capturedCard(0, [], "http://x/review"));
    assert.match(none, /Nothing new to review/);
    assert.ok(!none.includes("http://x/review"));
    assert.match(none, /human decides/i);

    const some = await render(capturedCard(2, ["Send the deck", "Use Supabase"], "http://x/review"));
    assert.match(some, /2 things sent to review/);
    assert.ok(some.includes("http://x/review"));
    assert.ok(some.includes("Send the deck"));
  });
});

describe("welcome", () => {
  it("promises not to write to the board", async () => {
    const out = await render(welcomeMessage("slack"));
    assert.match(out, /human click/i);
  });
});
