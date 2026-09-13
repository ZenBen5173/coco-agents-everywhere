# Submission — COCO

Agents, Everywhere · AI Tinkerers Kuala Lumpur · 12–13 September 2026

## Build eligibility

- [x] Net-new build created during the official hackathon period
- [x] Core functionality built during the event
- [x] Inherited pieces identified separately below

**What we inherited**

- The [Agents, Everywhere starter kit](https://github.com/CopilotKit/agents-everywhere-starter-kit): CopilotKit runtime wiring for web and Slack, the managed Channels lifecycle (`apps/channel/src/server.ts`), the `ChannelRunAgent` re-entry fix (`apps/channel/src/agent.ts`), the model adapter (`packages/agent-core/src/model.ts`), the web provider boundary, the test harness and `managed-gateway` fixture, and the Exa search tool (unused in the demo).
- UI primitives copied from a teammate's earlier personal project: shadcn-style components under `apps/web/src/components/ui`, the Notion-style data table under `gustflow-table`, the kanban under `kibo-ui`, and the Tailwind theme in `globals.css`. Also the *approach* to extraction (a date table in the prompt, model-resolved dates) from that project's Python bot, re-implemented in TypeScript here.

**What we built during the hackathon**

- The domain and the rule: Supabase schema with the `items_guard` trigger and `approve_capture()` — `supabase/schema.sql`.
- The listener: `apps/listener` — Socket Mode ingest, member sync, backfill, debounced extraction.
- The extractor and date handling: `packages/agent-core/src/capabilities/extract.ts`, `dates.ts`, `types.ts`, `supabase.ts`, the `COMMIT_ROLE` prompt.
- The web app: `apps/web/src/lib/store.tsx` (live data + the three actions), the review queue, the board (list / kanban / table, Mine / Everyone / Late / Done), the item editor, the chat tools (`app-control.tsx`) and the click-gated `approve_capture` / `bin_capture` (`generative-ui.tsx`), the three route handlers.
- The Slack agent's domain: `list_board`, `capture_from_thread`, the `item_list` card, the welcome card, the injectable store.
- Tests: dates, tools, components, listener message mapping.

## Title and description

**COCO** — a Slack group agent that hears what people commit to, and lets a human decide what counts.

**What you built.** A bot reads one team channel, turns commitments, decisions and deadlines into a review queue with the exact Slack line and speaker attached, and a human clicks Add / Edit-then-add / Bin. Approved items become the board. A chat panel takes corrections in plain English and moves the cards live, locking them against later reads.

**Who it is for.** A hackathon team of four in one Slack channel, the night before submission, who have made a dozen promises to each other in passing and cannot remember who said what by when.

**Why the context matters.** Nobody types anything into the tool. The commitments were already said in Slack, by the person who made them, with the date words they used. The bot knows who "I" is because Slack does, resolves "Sunday 6pm" in the team's timezone, and keeps the quote so the reviewer can tell a plan from a joke. Remove the channel and it is a to-do list somebody has to maintain.

**Sponsor technologies used.**
- CopilotKit — the web chat panel (React v2 hooks) and the managed Slack Channel.
- OpenRouter → OpenAI `gpt-5.6-sol` — extraction and the chat agent.
- Supabase — database, the trigger that enforces the rule, Realtime.

## Evidence for the judging criteria

| Criterion | Where to look in the demo |
|---|---|
| Core Requirements & Functionality | A message in Slack → a capture on `/review` within seconds → click Add → it is on `/board`. Refresh; it is still there (a real Supabase row). |
| Innovation & Theme Alignment | The source line and speaker on every card. "let Jason do everything" arrives at 18% confidence and gets binned. Try the same with a blank chatbox: there is nothing to bin. |
| Technical Execution & Integration | Insert into `items` directly in SQL without an approved capture → Postgres refuses. Type "approve all of those" in chat → one click card per item, none of them auto-approved. Decline one → "nothing changed". |
| Usefulness & Agentic Experience | "the AWS deadline is tomorrow, not today" → the card moves and shows the confirmed lock; the next read of Slack cannot undo it. Mine / Late tabs answer the two questions people actually have. |

- [x] Live services: Slack (Socket Mode + managed Channel), Supabase, OpenRouter
- [x] Sample data: the seeded demo messages are labelled in the channel history; everything else is live
- [x] Session-only state: the managed Channel's thread subscriptions (in-memory); the "who are you" picker (localStorage)

## Public repository

- [ ] Clean-clone quickstart in [README.md](README.md)
- [x] Credentials and processes listed
- [x] `npm run verify` passes
- [x] `.env` excluded; `.env.example` documents every variable

## Two-minute demo video

1. Show the channel with a few real messages already in it.
2. Type one more commitment; cut to `/review` as it appears.
3. Add one, Edit-then-add one (fix the owner), Bin the joke.
4. Board: Mine / Late. Type the correction in chat; watch the card move and lock.
5. `@commit-bot what's late?` in Slack → native card.
6. Say which sponsors did what.

## Social post and final submission

- [ ] Post tagging the event partners per organizer instructions
- [ ] Link repository and video
- [ ] Final secret sweep of repo, video, screenshots
