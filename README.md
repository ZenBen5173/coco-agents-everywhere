# COCO

**A Slack group agent that hears what people commit to — and lets a human decide what counts.**

Built for [Agents, Everywhere](https://aitinkerers.org/hackathons/global/agents-everywhere) (AI Tinkerers, Kuala Lumpur, 12–13 September 2026).

## What it does

A small team coordinates in one Slack channel. Commitments, decisions and deadlines are made in passing — "I'll finish the schema tonight", "let's go with Supabase", "submission closes Sunday 6pm" — and then lost in the scroll.

COCO reads that channel and turns those lines into a **review queue**. A human opens the review page and clicks **Add**, **Edit-then-add**, or **Bin** on each one. Only what a human approves lands on the **task board**, with an owner, a due date, a status, and the exact Slack line it came from. A chat panel on every page takes corrections in plain English — *"the AWS deadline is tomorrow, not today"* — and the card moves on screen, locked against later reads of the channel.

**The rule that defines it:** the AI only ever writes to the review queue. Only a human action puts something on the board. That is enforced in Postgres by a trigger, not by convention: an `items` row can only be inserted for a capture whose status is `approved`, and the only code path that flips a capture to `approved` is the human's click.

## Why the context matters

Take the Slack channel away and this is a to-do app someone has to type into. The whole value is that nobody types anything: the commitments were already said, in the place they were said, by the person who said them. The bot knows who "I" is because Slack does, resolves "tomorrow" in the team's timezone, and keeps the quote so a reviewer can judge whether "let Jason do everything" was a plan or a joke.

## The parts

```
Slack #channel
   │
   ├─► apps/listener  · "Tally" · our own Slack app, Socket Mode
   │       stores every message → batches it through the extractor → captures (pending)
   │
   └─► apps/channel   · "COCO" · CopilotKit managed Channel
           @mention → answers "what's late / pending / mine" with native cards,
           can send a thread to review. Never writes to the board.

apps/web  · Next.js + CopilotKit React v2 + Supabase Realtime
   /review  Add · Edit-then-add · Bin
   /board   Mine · Everyone · Late · Done  (list / kanban / table), filtered by list
   /notes   sticky notes · /progress  streak, quests, buddies
   chat panel on every page → update_item, approve_capture (click-gated), bin_capture (click-gated)

packages/agent-core · the shared brain: model selection, the extractor, date handling, prompt
Supabase · members · messages · captures · items  (+ the trigger, + approve_capture())
```

## Run it

Node 24 (22+ works). One `.env` at the root — see [.env.example](.env.example).

```bash
npm ci
cp .env.example .env     # fill in model, Slack, Supabase
```

Create the database: run [supabase/schema.sql](supabase/schema.sql) in your project's SQL editor (it is exactly the migration the demo uses).

Then, in three terminals:

```bash
npm run dev:listener     # Tally — reads the channel, fills the review queue
npm run dev:web          # http://127.0.0.1:3100
npm run dev:slack        # optional — the @mention surface (needs CopilotKit Intelligence)
```

Say something in the channel that sounds like a promise. Within ~10 seconds it is on `/review`.

Offline checks (no credentials needed):

```bash
npm run verify           # typecheck + tests across every workspace
```

### Hosting the bots

The web app deploys to Vercel. The two bots are long-running processes and
cannot; [render.yaml](render.yaml) runs both as one free Render web service.
In Render: **New → Blueprint**, pick this repo, paste the secrets it asks for.
The service runs `npm run start:bots`, which starts Tally and COCO under one
supervisor ([scripts/bots.mjs](scripts/bots.mjs)), answers `/healthz` with the
state of both, restarts either on a crash, and pings itself every five minutes
so the free instance never sleeps. Stop the local copies once it is up: two
runtimes on the same Channel code race for every delivery.

## Credentials you need

| Piece | What | Where |
|---|---|---|
| Model | OpenRouter key (any tool-capable model; we used `openai/gpt-5.6-sol`) | [openrouter.ai/keys](https://openrouter.ai/keys) |
| Listener | Your own Slack app: bot token + app token, Socket Mode on, bot in the channel. Scopes `channels:history channels:read users:read app_mentions:read`, event `message.channels` | [api.slack.com/apps](https://api.slack.com/apps) |
| Database | Supabase project URL, anon key, service-role key | Project settings → API |
| Reply surface (optional) | CopilotKit Intelligence project key + Channel code | [intelligence.copilotkit.ai](https://intelligence.copilotkit.ai) |
| Calendar (optional) | Google OAuth client id + secret, redirect URI `http://127.0.0.1:3100/api/google/callback` | Google Cloud console |

## How the pieces behave

- **Extraction** (`packages/agent-core/src/capabilities/extract.ts`): the model gets the last few messages for context, the new ones to extract from, the member list, and a table of the next fourteen dates with their weekdays. It returns typed captures with a confidence. Jokes are allowed through at low confidence; a human bins them. Dates come back as `YYYY-MM-DD[THH:MM]` and are resolved in `USER_TIMEZONE`, never UTC.
- **Dedupe**: `captures` is unique on `(source_ts, type, title)`, so re-reading a thread never duplicates.
- **Approval** (`approve_capture()` in Postgres): marks the capture approved and inserts the item in one transaction. Any override from Edit-then-add marks the item `human_confirmed`.
- **Corrections** (`PATCH /api/items/:id`): from the sheet, the table, a kanban drag, or the chat — every path sets `human_confirmed = true`.
- **Chat gates**: `approve_capture` and `bin_capture` are human-in-the-loop tools. The agent proposes, a card waits, the person clicks. Typing "approve all of those" still ends in one click per item.
- **Live**: the pages subscribe to Supabase Realtime on `captures` and `items`, with a 20-second poll as a fallback.
- **Notes** (`/notes`): sticky notes for things worth keeping that aren't tasks — markdown, checklists, six paper colours, pin, archive, drag to reorder. Stored verbatim; no model call on the way in. The chat can `add_note`.
- **Lists**: an open tag on items and captures (`hackathon`, `personal`…). The sidebar shows every list with its open count; click to filter the board, type "New list…" to start one. Set from the editor, the table, or by telling the chat.
- **Progress** (`/progress`, ported from myTask's game engine into `packages/agent-core/src/capabilities/game.ts`): XP and coins for promises kept — finishing, meeting a deadline, finishing early, clearing something overdue — a forgiving streak with grace days and freezes, three daily quests, eggs that hatch buddies who multiply earnings. Per member. Rewards come only from real work and nothing is ever taken away; every number is recomputed server-side.
- **Google Calendar** (`packages/agent-core/src/capabilities/calendar.ts`, ported from myTask): one shared team calendar, connected once from the sidebar (or a refresh token in `.env`). Approving an item with a due date creates an event; changing the date moves it; done ticks it off (`✓`, time freed); dropped deletes it. Best-effort — the board never waits on Google.

## Sponsor technologies

- **CopilotKit** — the web chat panel (React v2: `useAgentContext`, `useFrontendTool`, `useHumanInTheLoop`, `useComponent`) and the managed Slack Channel (`@copilotkit/channels`).
- **OpenRouter → OpenAI `gpt-5.6-sol`** — extraction and the chat agent, through the kit's shared model adapter.
- **Supabase** — the database, the trigger that enforces the rule, and Realtime.

## What we inherited and what we built

Inherited: the [Agents, Everywhere starter kit](https://github.com/CopilotKit/agents-everywhere-starter-kit) (CopilotKit runtime wiring, the Channels lifecycle, the web provider boundary, the `ChannelRunAgent` re-entry fix, the model adapter, test harness), and UI primitives (shadcn-style components, a Notion-style data table, a kanban) copied from a teammate's earlier personal project.

Built during the event: everything about the domain — the Supabase schema and its trigger, the listener, the extractor and its date handling, the review queue, the board, the chat tools and gates, the Slack tools and cards, the prompts, and the tests for them. See [SUBMISSION.md](SUBMISSION.md).

## Known limits

- Row-level security is off; the browser reads with the anon key. Every write goes through the server, and the board is protected by the trigger, but a public deployment would want RLS and real auth.
- One channel. `SLACK_CHANNEL_ID` is the whole configuration.
- "Mine" is whoever you pick in the sidebar — there is no sign-in.
- The listener keeps its state in Supabase, so restarts backfill what they missed; the managed Channel's subscriptions are in-memory and reset on restart.
