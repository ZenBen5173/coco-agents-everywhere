/**
 * Tally — the silent listener.
 *
 * Runs on our own Slack app over Socket Mode (no public URL). Every message in
 * the configured channel is stored, then batched through the extractor into the
 * review queue. It never posts to Slack and never writes to the board.
 */
import { App, LogLevel } from "@slack/bolt";
import { serviceClient, resolveTimeZone } from "agent-core";
import { backfill, ensureMember, syncMembers, toMessageRow } from "./slack";
import { createIngest } from "./ingest";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}. Add it to the root .env.`);
  return value;
}

const CHANNEL_ID = required("SLACK_CHANNEL_ID");
const timeZone = resolveTimeZone();
const db = serviceClient();

const app = new App({
  token: required("SLACK_BOT_TOKEN"),
  appToken: required("SLACK_APP_TOKEN"),
  socketMode: true,
  logLevel: LogLevel.WARN,
});

const ingest = createIngest({
  db,
  timeZone,
  debounceMs: Number(process.env.EXTRACT_DEBOUNCE_MS ?? 8_000),
  log: (line) => console.log(`[tally] ${line}`),
});

app.event("message", async ({ event }) => {
  if (event.channel !== CHANNEL_ID) return;
  const row = toMessageRow(event as Parameters<typeof toMessageRow>[0], CHANNEL_ID);
  if (!row) return;
  await ensureMember(app.client, db, row.user_id!);
  const { error } = await db.from("messages").upsert(row, { onConflict: "ts", ignoreDuplicates: true });
  if (error) {
    console.error(`[tally] store message ${row.ts} failed: ${error.message}`);
    return;
  }
  console.log(`[tally] stored ${row.ts} from ${row.user_id}: ${row.text.slice(0, 60)}`);
  ingest.schedule();
});

await app.start();
const members = await syncMembers(app.client, db);
const backfilled = await backfill(app.client, db, CHANNEL_ID);
console.log(`[tally] online · channel ${CHANNEL_ID} · ${members.length} members synced · ${backfilled} message(s) backfilled · tz ${timeZone}`);
await ingest.runNow();

// Keep the member list fresh without a restart.
setInterval(() => void syncMembers(app.client, db).catch((e) => console.error(`[tally] member sync: ${e}`)), 10 * 60_000);

const shutdown = async () => {
  await app.stop();
  process.exit(0);
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
